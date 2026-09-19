"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminSupabase as createServiceSupabase } from "@/lib/supabase/admin";
import { getCurrentTenantId, getCurrentTenant } from "@/lib/tenant";
import {
  connectInstance,
  connectionState,
  createInstance,
  deleteInstance,
  EvolutionError,
  logoutInstance,
  normalizeQrSrc,
  setWebhook,
} from "@/lib/evolution";
import { headers } from "next/headers";
import { resolveTenantOrigin } from "@/lib/tenant-host";
import {
  actionError,
  actionOk,
  toUserMessage,
  type ActionResult,
} from "@/lib/errors";

/**
 * Server actions da tela /admin/whatsapp.
 *
 * Cada tenant opera sua propria instancia Evolution (slug = instanceName).
 * Estado cacheado em `tenants.evolution_*` — atualizado pelas actions
 * via service_role pra evitar RLS atrapalhar o sync.
 *
 * Fluxos:
 *   - `provisionEvolution`  : cria instance + set webhook + retorna QR
 *   - `refreshEvolutionQr`  : chamada pelo polling no client (8s)
 *   - `disconnectEvolution` : logout (preserva instance)
 *   - `getEvolutionStatus`  : leitura + sync leve com a Evolution
 */

/** URL publica do webhook Evolution — usado pelo setWebhook.
 *  Resolvida dinamicamente pelo tenant ativo (slug + Host) para que cada
 *  tenant registre o webhook no SEU subdomínio, não num fixo do env. */
async function publicWebhookUrl(): Promise<string> {
  const tenant = await getCurrentTenant();
  const host = (await headers()).get("host");
  const origin = resolveTenantOrigin(host, tenant.slug);
  return `${origin}/api/webhooks/evolution`;
}

/** Helper: atualiza o cache local do tenant na tabela `tenants`. */
async function patchTenantEvolution(
  tenantId: string,
  patch: {
    evolution_state?: "open" | "close" | "connecting" | null;
    evolution_owner_jid?: string | null;
    evolution_connected_at?: string | null;
    evolution_webhook_set?: boolean;
    evolution_instance_name?: string;
  },
): Promise<void> {
  const admin = createServiceSupabase();
  const { error } = await admin.from("tenants").update(patch).eq("id", tenantId);
  if (error) {
    console.warn("[evolution] falha ao sincronizar cache local", {
      tenantId,
      error: error.message,
    });
  }
}

function explainEvolution(err: unknown): string {
  if (err instanceof EvolutionError) {
    // Casos mais comuns mapeados pra PT-BR legivel.
    if (err.status === 401) return "Chave da Evolution invalida. Confira EVOLUTION_API_KEY.";
    if (err.status === 403) return "Evolution recusou a operacao (instancia em uso?).";
    if (err.status === 404) return "Instancia ainda nao existe — recriando automaticamente...";
    if (err.status === 409) return "Instancia ja existe ou esta em estado conflitante.";
    if (err.status >= 500) return "Evolution API fora do ar. Tente em alguns segundos.";
    return `Evolution respondeu ${err.status}.`;
  }
  if (err instanceof Error) return err.message;
  return "Falha desconhecida ao falar com a Evolution.";
}

/**
 * Detecta "instancia zumbi": Evolution diz que esta `open` mas nao tem
 * `ownerJid` (sem numero pareado). A UI mostra "Connected" sem ninguem
 * conectado de verdade — e o envio de mensagens falha silenciosamente.
 *
 * Causas conhecidas: crash do Baileys no scan, conflito de versao da
 * Evolution, sessao expirada sem logout.
 *
 * Retorna true quando precisa forcar recreate.
 */
async function isZombieInstance(name: string): Promise<{
  zombie: boolean;
  state: string | null;
  ownerJid: string | null;
}> {
  try {
    const cs = await connectionState(name);
    const state = cs?.state ?? null;
    const ownerJid = cs?.ownerJid ?? null;
    // "open" sem JID = zumbi. "open" com JID = saudavel.
    return { zombie: state === "open" && !ownerJid, state, ownerJid };
  } catch (err) {
    // Se connectionState falhar (404/500), assume estado desconhecido.
    // provisionEvolution vai tentar o recreate por garantia.
    console.warn("[evolution] connectionState falhou", { name, err: explainEvolution(err) });
    return { zombie: false, state: null, ownerJid: null };
  }
}

export async function provisionEvolution(): Promise<
  ActionResult<{ qrcode?: string; state: string }>
> {
  let tenantId: string;
  try {
    tenantId = await getCurrentTenantId();
  } catch (err) {
    return actionError(toUserMessage(err));
  }

  const supabase = await createServerSupabase();
  const { data: tenant } = await supabase
    .from("tenants")
    .select("slug, evolution_instance_name, evolution_webhook_set, evolution_state, evolution_owner_jid")
    .eq("id", tenantId)
    .single();

  if (!tenant) return actionError("Tenant nao encontrado.");

  const instanceName = tenant.evolution_instance_name ?? (tenant as { slug: string }).slug;
  const webhookUrl = await publicWebhookUrl();

  // 0) Detecta e quebra zumbi ANTES de tudo. Se a Evolution diz `open`
  // sem ownerJid, a sessao nao existe — forcar logout + delete + recreate.
  const z = await isZombieInstance(instanceName);
  if (z.zombie) {
    console.warn("[evolution] zumbi detectado, recriando do zero", {
      instanceName,
      state: z.state,
      ownerJid: z.ownerJid,
    });
    await forceRecreateInstance(instanceName);
    await patchTenantEvolution(tenantId, {
      evolution_state: "close",
      evolution_owner_jid: null,
      evolution_connected_at: null,
    });
  }

  // 1) Cria instance se nao existe. A Evolution retorna:
  //    - 200/201: criou agora.
  //    - 403: ja existe (bloqueia re-create). Idempotente.
  //    - 409: conflito (raro). Idempotente.
  //    - 404: nunca vi, mas por seguranca trata como idempotente tambem.
  try {
    await createInstance(instanceName);
  } catch (err) {
    const isIdempotent =
      err instanceof EvolutionError &&
      (err.status === 403 || err.status === 409 || err.status === 404);
    if (!isIdempotent) {
      const msg = explainEvolution(err);
      console.warn("[evolution] createInstance falhou (continuando)", {
        instanceName,
        msg,
      });
    }
  }

  // 2) Seta webhook se ainda nao foi.
  let webhookConfigured = Boolean(tenant.evolution_webhook_set);
  if (!webhookConfigured) {
    try {
      await setWebhook(instanceName, webhookUrl);
      webhookConfigured = true;
    } catch (err) {
      const msg = explainEvolution(err);
      console.warn("[evolution] setWebhook falhou (continuando sem bloquear QR)", {
        instanceName,
        msg,
      });
    }
  }

  // 3) Cache local: webhook_set reflete o que DE FATO foi setado na Evolution.
  await patchTenantEvolution(tenantId, {
    evolution_instance_name: instanceName,
    evolution_webhook_set: webhookConfigured,
  });

  // 4) Pega QR / status atual.
  let qrcode: string | undefined;
  let state = tenant.evolution_state ?? null;
  try {
    const conn = await connectInstance(instanceName);
    const raw = conn?.base64 ?? conn?.qrcode ?? conn?.code ?? undefined;
    qrcode = raw ? normalizeQrSrc(raw) : undefined;
    const s = (conn as { instance?: { state?: string } } | undefined)?.instance?.state;
    if (s === "open" || s === "close" || s === "connecting") {
      state = s;
      await patchTenantEvolution(tenantId, {
        evolution_state: state,
        evolution_connected_at: state === "open" ? new Date().toISOString() : null,
      });
    }
  } catch (err) {
    const msg = explainEvolution(err);
    return actionError(`Evolution criou a instancia mas nao retornou QR: ${msg}`);
  }

  revalidatePath("/admin/whatsapp");
  return actionOk({
    qrcode,
    state: state ?? "close",
    webhook_pending: !webhookConfigured,
    zumbi_recriado: z.zombie,
  });
}

/** Action separada pra "comecar do zero" — usada pelo botao de reset no admin. */
export async function recreateEvolution(): Promise<
  ActionResult<{ qrcode?: string; state: string }>
> {
  let tenantId: string;
  try {
    tenantId = await getCurrentTenantId();
  } catch (err) {
    return actionError(toUserMessage(err));
  }

  const supabase = await createServerSupabase();
  const { data: tenant } = await supabase
    .from("tenants")
    .select("slug, evolution_instance_name")
    .eq("id", tenantId)
    .single();
  if (!tenant) return actionError("Tenant nao encontrado.");

  const instanceName =
    tenant.evolution_instance_name ?? (tenant as { slug: string }).slug;
  const webhookUrl = await publicWebhookUrl();

  try {
    await forceRecreateInstance(instanceName);
    await createInstance(instanceName);
    await setWebhook(instanceName, webhookUrl);
    await patchTenantEvolution(tenantId, {
      evolution_instance_name: instanceName,
      evolution_webhook_set: true,
      evolution_state: "close",
      evolution_owner_jid: null,
      evolution_connected_at: null,
    });
    const conn = await connectInstance(instanceName);
    const raw = conn?.base64 ?? conn?.qrcode ?? conn?.code ?? undefined;
    const qrcode = raw ? normalizeQrSrc(raw) : undefined;
    revalidatePath("/admin/whatsapp");
    return actionOk({ qrcode, state: "close" });
  } catch (err) {
    return actionError(`Falha ao recriar instancia: ${explainEvolution(err)}`);
  }
}

/** Best-effort: logout (se houver) + delete + create. Cada passo logado
 *  separadamente — se algum falhar, segue tentando o proximo. */
async function forceRecreateInstance(name: string): Promise<void> {
  try {
    await logoutInstance(name);
    console.info("[evolution] recreate: logout ok", { name });
  } catch (err) {
    console.warn("[evolution] recreate: logout falhou (continuando)", {
      name,
      err: explainEvolution(err),
    });
  }
  try {
    await deleteInstance(name);
    console.info("[evolution] recreate: delete ok", { name });
  } catch (err) {
    console.warn("[evolution] recreate: delete falhou (continuando)", {
      name,
      err: explainEvolution(err),
    });
  }
}

export async function refreshEvolutionQr(): Promise<
  ActionResult<{ qrcode?: string; state: string }>
> {
  let tenantId: string;
  try {
    tenantId = await getCurrentTenantId();
  } catch (err) {
    return actionError(toUserMessage(err));
  }

  const supabase = await createServerSupabase();
  const { data: tenant } = await supabase
    .from("tenants")
    .select("slug, evolution_instance_name")
    .eq("id", tenantId)
    .single();

  if (!tenant) return actionError("Tenant nao encontrado.");
  const instanceName =
    tenant.evolution_instance_name ?? (tenant as { slug: string }).slug;

  let qrcode: string | undefined;
  let state: "open" | "close" | "connecting" = "close";
  try {
    const conn = await connectInstance(instanceName);
    const raw =
      conn?.base64 ?? conn?.qrcode ?? conn?.code ?? undefined;
    qrcode = raw ? normalizeQrSrc(raw) : undefined;
    const s = (conn as { instance?: { state?: string } } | undefined)?.instance?.state;
    if (s === "open" || s === "connecting") state = s;
    await patchTenantEvolution(tenantId, {
      evolution_state: state,
      evolution_connected_at:
        state === "open" ? new Date().toISOString() : null,
    });
  } catch (err) {
    return actionError(explainEvolution(err));
  }

  return actionOk({ qrcode, state });
}

/**
 * Desconectar = logout + delete + recriar do zero + entregar QR novo.
 *
 * O Isaías pediu que o botao "Desconectar" tambem ja deixe a instancia
 * pronta pro lojista escanear (em vez de deixar a UI em estado morto
 * "Desconectado"). Segue o mesmo padrao do syncEvolutionStatus quando
 * a instancia nao existe, mas disparado por acao explicita do usuario.
 */
export async function disconnectEvolution(): Promise<
  ActionResult<{ qrcode?: string; state: string }>
> {
  let tenantId: string;
  try {
    tenantId = await getCurrentTenantId();
  } catch (err) {
    return actionError(toUserMessage(err));
  }

  const supabase = await createServerSupabase();
  const { data: tenant } = await supabase
    .from("tenants")
    .select("evolution_instance_name, slug")
    .eq("id", tenantId)
    .single();

  if (!tenant) return actionError("Tenant nao encontrado.");
  const instanceName =
    tenant.evolution_instance_name ?? (tenant as { slug?: string }).slug;
  if (!instanceName) return actionError("Instancia ainda nao provisionada.");

  // 1) Limpa cache IMEDIATAMENTE (mesmo que a Evolution esteja fora).
  // Garante que a UI nao mostre "Conectado" entre o clique e o sync.
  await patchTenantEvolution(tenantId, {
    evolution_state: "close",
    evolution_owner_jid: null,
    evolution_connected_at: null,
  });

  // 2) Tenta logout + delete na Evolution (best-effort — 404 = ja era).
  try {
    await logoutInstance(instanceName);
  } catch (err) {
    if (!(err instanceof EvolutionError) || err.status !== 404) {
      console.warn("[evolution/disconnect] logout falhou (continuando)", {
        instanceName,
        err: explainEvolution(err),
      });
    }
  }
  try {
    await deleteInstance(instanceName);
  } catch (err) {
    if (!(err instanceof EvolutionError) || err.status !== 404) {
      console.warn("[evolution/disconnect] delete falhou (continuando)", {
        instanceName,
        err: explainEvolution(err),
      });
    }
  }

  // 3) Recria + configura webhook + puxa QR novo. Se a Evolution estiver
  // fora do ar, devolve erro — UI mostra e o usuario pode retentar.
  let qrcode: string | undefined;
  try {
    try {
      await createInstance(instanceName);
    } catch (err) {
      const isIdempotent =
        err instanceof EvolutionError &&
        (err.status === 403 || err.status === 409 || err.status === 404);
      if (!isIdempotent) throw err;
    }
    try {
      await setWebhook(instanceName, await publicWebhookUrl());
      await patchTenantEvolution(tenantId, { evolution_webhook_set: true });
    } catch (err) {
      console.warn("[evolution/disconnect] setWebhook falhou (continuando)", {
        instanceName,
        err: explainEvolution(err),
      });
    }
    const conn = await connectInstance(instanceName);
    const raw = conn?.base64 ?? conn?.qrcode ?? conn?.code ?? undefined;
    qrcode = raw ? normalizeQrSrc(raw) : undefined;
  } catch (err) {
    return actionError(
      `Desconectado, mas nao consegui gerar novo QR: ${explainEvolution(err)}`,
    );
  }

  revalidatePath("/admin/whatsapp");
  return actionOk({ qrcode, state: "close" });
}

/**
 * Sincroniza o estado cacheado do tenant com a REALIDADE da Evolution.
 *
 * Esta eh a fonte de verdade da UI — chamada automaticamente quando a
 * pagina /admin/whatsapp carrega e tambem pelo card client no polling.
 * NAO retorna erro quando a instancia nao existe: em vez disso, marca
 * como `close` + limpa o JID + dispara auto-recriacao para o lojista
 * ter QR Code novo sem ter que clicar em botao.
 *
 * Comportamento:
 *   1. `connectionState` 200 → copia state/JID pro banco. Se `open` sem
 *      JID = zumbi → recicla (logout+delete+create) e retorna close.
 *   2. `connectionState` 404 → instancia morreu (delete manual, restart).
 *      Limpa cache. Auto-cria nova instancia e puxa QR pra ja entregar
 *      pro cliente. Devolve `state: 'close'` com qrcode.
 *   3. Erro de rede / 5xx → nao mexe no banco (cache continua igual),
 *      devolve erro pro chamador lidar.
 *
 * Retorna SEMPRE estado final coerente (mesmo em caso de 404 da
 * Evolution): a UI nunca deve exibir "Conectado" se a Evolution diz
 * que nao ha instancia.
 */
export async function syncEvolutionStatus(): Promise<
  ActionResult<{
    state: string;
    ownerJid: string | null;
    qrcode?: string;
    auto_recreated?: boolean;
  }>
> {
  let tenantId: string;
  try {
    tenantId = await getCurrentTenantId();
  } catch (err) {
    return actionError(toUserMessage(err));
  }

  const supabase = await createServerSupabase();
  const { data: tenant } = await supabase
    .from("tenants")
    .select("evolution_instance_name, slug, evolution_webhook_set")
    .eq("id", tenantId)
    .single();

  if (!tenant) return actionError("Tenant nao encontrado.");
  const instanceName =
    tenant.evolution_instance_name ?? (tenant as { slug?: string }).slug;
  if (!instanceName) return actionError("Instancia ainda nao provisionada.");

  // 1) Probe REAL na Evolution.
  let probe: {
    found: boolean;
    state: "open" | "close" | "connecting";
    ownerJid: string | null;
  } = { found: false, state: "close", ownerJid: null };

  try {
    const cs = await connectionState(instanceName);
    const s = (cs as { state?: string; ownerJid?: string | null } | undefined)?.state;
    const j = (cs as { ownerJid?: string | null } | undefined)?.ownerJid ?? null;
    if (s === "open" || s === "close" || s === "connecting") {
      probe = { found: true, state: s, ownerJid: j };
    } else {
      // Resposta estranha (sem state conhecido) → tratar como nao encontrado.
      probe = { found: false, state: "close", ownerJid: null };
    }
  } catch (err) {
    if (err instanceof EvolutionError && err.status === 404) {
      // Instancia realmente nao existe. Segue o fluxo de auto-recriacao.
      probe = { found: false, state: "close", ownerJid: null };
    } else {
      // 5xx / rede / 401 → NAO mexe no banco. Devolve erro.
      return actionError(explainEvolution(err));
    }
  }

  let autoRecreated = false;
  let qrcode: string | undefined;

  // 2) Zumbi: state=open sem JID → reciclar.
  if (probe.found && probe.state === "open" && !probe.ownerJid) {
    console.warn("[evolution/sync] zumbi detectado, recriando", {
      tenantId, instanceName,
    });
    await forceRecreateInstance(instanceName);
    await patchTenantEvolution(tenantId, {
      evolution_state: "close",
      evolution_owner_jid: null,
      evolution_connected_at: null,
    });
    probe = { found: false, state: "close", ownerJid: null };
  }

  // 3) Instancia nao existe (404 ou zumbi reciclado) → auto-criar + QR.
  if (!probe.found) {
    try {
      try {
        await createInstance(instanceName);
      } catch (err) {
        // 403/409/404 = idempotente (ja existe). Segue pro webhook+connect.
        const isIdempotent =
          err instanceof EvolutionError &&
          (err.status === 403 || err.status === 409 || err.status === 404);
        if (!isIdempotent) {
          // Erro real de criacao. Loga e segue — pode ja existir.
          console.warn("[evolution/sync] createInstance falhou (continuando)", {
            instanceName,
            err: explainEvolution(err),
          });
        }
      }
      // Re-seta webhook se necessario (idempotente na Evolution).
      if (!tenant.evolution_webhook_set) {
        try {
          await setWebhook(instanceName, await publicWebhookUrl());
          await patchTenantEvolution(tenantId, { evolution_webhook_set: true });
        } catch (err) {
          console.warn("[evolution/sync] setWebhook falhou (continuando)", {
            instanceName,
            err: explainEvolution(err),
          });
        }
      }
      const conn = await connectInstance(instanceName);
      const raw = conn?.base64 ?? conn?.qrcode ?? conn?.code ?? undefined;
      qrcode = raw ? normalizeQrSrc(raw) : undefined;
      autoRecreated = true;
    } catch (err) {
      // Nao conseguiu recriar — deixa UI mostrar erro e tentar de novo.
      await patchTenantEvolution(tenantId, {
        evolution_state: "close",
        evolution_owner_jid: null,
        evolution_connected_at: null,
      });
      return actionError(
        `Instancia sumiu e nao conseguimos recriar: ${explainEvolution(err)}`,
      );
    }
  }

  // 4) Cache local reflete a verdade.
  await patchTenantEvolution(tenantId, {
    evolution_state: probe.found ? probe.state : "close",
    evolution_owner_jid: probe.found ? probe.ownerJid : null,
    evolution_connected_at:
      probe.found && probe.state === "open" ? new Date().toISOString() : null,
  });

  revalidatePath("/admin/whatsapp");
  return actionOk({
    state: probe.found ? probe.state : "close",
    ownerJid: probe.found ? probe.ownerJid : null,
    qrcode,
    auto_recreated: autoRecreated,
  });
}
