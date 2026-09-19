import { NextResponse, type NextRequest } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { forwardEvolutionEvent } from "@/lib/n8n";

/**
 * Webhook centralizado da Evolution API.
 *
 * TODAS as instancias dos tenants do Mendes apontam para esta URL
 * (configurada em `provisionEvolution` via /webhook/set/<instance>).
 * A Evolution identifica qual instancia mandou o evento pelo campo
 * `instance` no payload, e a gente roteia pelo slug → tenant_id.
 *
 * Por design, NAO validamos HMAC: Evolution v2.3.7 nao envia assinatura
 * util. Seguranca via obscuridade da URL + checagem de `instance`
 * conhecida no DB. TODO: revisar quando Evolution ganhar auth nativa.
 *
 * REGRA DE OURO: sempre 200. Se a Evolution receber <200 ela reenvia ate
 * bater limite e banir a URL — mesmo padrao do webhook do MP.
 */

export const dynamic = "force-dynamic";

interface EvolutionPayload {
  event?: string;
  instance?: string;
  data?: Record<string, unknown> | null;
  date_time?: string;
  apikey?: string;
  sender?: string;
  server_url?: string;
}

export async function POST(request: NextRequest) {
  let body: EvolutionPayload | null = null;
  try {
    body = (await request.json()) as EvolutionPayload;
  } catch {
    // Body invalido — ignora silenciosamente (Evolution manda ping/HEALTH).
    return NextResponse.json({ ok: true, ignored: "body_invalido" }, { status: 200 });
  }

  if (!body || !body.event || !body.instance) {
    return NextResponse.json(
      { ok: true, ignored: "payload_sem_event_ou_instance" },
      { status: 200 },
    );
  }

  const { event, instance, data } = body;

  const admin = createAdminSupabase();
  const { data: tenant, error: lookupError } = await admin
    .from("tenants")
    .select("id, evolution_instance_name")
    .eq("evolution_instance_name", instance)
    .maybeSingle();

  if (lookupError) {
    console.error("[webhook/evolution] lookup tenant falhou", {
      instance,
      error: lookupError.message,
    });
    return NextResponse.json({ ok: false }, { status: 200 });
  }

  if (!tenant) {
    // Instancia existe na Evolution mas nao ta mapeada em nenhum tenant.
    // Pode ser a instancia `automacaojs` antiga do DeskcommCRM ou um
    // webhook que sobrou. Loga e segue (200) pra Evolution parar de
    // reenviar.
    console.warn("[webhook/evolution] instancia desconhecida:", instance);
    return NextResponse.json({ ok: true, ignored: "instance_desconhecida" }, { status: 200 });
  }

  try {
    switch (event) {
      case "CONNECTION_UPDATE": {
        const stateRaw = (data?.state as string | undefined) ?? null;
        const state =
          stateRaw === "open" || stateRaw === "close" || stateRaw === "connecting"
            ? stateRaw
            : null;
        const ownerJid =
          (data?.user as { id?: string | null } | undefined)?.id ??
          ((data?.jid as string | undefined) ?? null);
        const isOpen = state === "open";
        const { error: updateError } = await admin
          .from("tenants")
          .update({
            evolution_state: state,
            evolution_owner_jid: ownerJid,
            evolution_connected_at: isOpen ? new Date().toISOString() : null,
          })
          .eq("id", tenant.id);
        if (updateError) {
          console.warn("[webhook/evolution] update tenant falhou", {
            instance,
            error: updateError.message,
          });
        }
        break;
      }

      case "QRCODE_UPDATED": {
        // QR rotacionou — a action `refreshEvolutionQr` busca do banco da
        // Evolution quando o cliente pedir. Aqui so repassamos pro n8n
        // caso ele queira manter log proprio.
        break;
      }

      case "MESSAGES_UPSERT": {
        // Cliente mandou mensagem pra loja. Hoje o bot de resposta vive
        // no n8n — repassamos o evento cru pra N8N_ORDER_WEBHOOK_URL com
        // `source: "evolution"` pra ele rotear.
        void forwardEvolutionEvent({
          source: "evolution",
          event,
          instance,
          tenant_id: tenant.id,
          data: data ?? null,
          date_time: body.date_time ?? null,
        });
        break;
      }

      case "SEND_MESSAGE":
      case "SEND_MESSAGE_UPDATE":
      case "MESSAGES_UPDATE":
      case "MESSAGES_EDITED":
      case "MESSAGES_DELETE":
      case "MESSAGES_SET":
      case "CONTACTS_UPSERT":
      case "CHATS_UPSERT":
      case "GROUPS_UPSERT":
      case "PRESENCE_UPDATE":
      default: {
        // Eventos nao tratados explicitamente — segue sendo 200.
        break;
      }
    }
  } catch (err) {
    console.error("[webhook/evolution] handler crash", {
      instance,
      event,
      error: err instanceof Error ? err.message : String(err),
    });
    // 200 mesmo em erro interno.
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}

/** Healthcheck pra Isaías testar sem mandar payload completo. */
export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      route: "webhooks/evolution",
      ts: new Date().toISOString(),
    },
    { status: 200 },
  );
}
