import "server-only";

/**
 * Cliente HTTP fino pra Evolution API v2.x (https://evo.automacaojs.us).
 *
 * Cada tenant do Mendes tem sua propria instancia na Evolution, nomeada
 * pelo slug (ex: "mendes-teste", "formiga"). Os 4 endpoints mais usados:
 *
 *   POST   /instance/create             — provisiona (idempotente via flag local)
 *   GET    /instance/connect/<name>     — pega QR base64 (quando desconectado)
 *   GET    /instance/connectionState/<name> — ping rapido
 *   DELETE /instance/logout/<name>      — desloga WhatsApp, preserva instance
 *   DELETE /instance/delete/<name>      — remove instance inteira (raro)
 *   POST   /webhook/set/<name>          — aponta webhook centralizado
 *
 * Tudo via header `apikey: <EVOLUTION_API_KEY>`. Sem autenticacao por IP.
 * Timeout 5s por padrao — alinhado com `sendOrderToN8N` (src/lib/n8n.ts)
 * pra manter SLA consistente.
 *
 * Validado contra Evolution v2.3.7 via probe.
 */

const BASE = process.env.EVOLUTION_API_URL?.trim() || "https://evo.automacaojs.us";
const KEY = process.env.EVOLUTION_API_KEY?.trim();

export function getEvolutionBaseUrl(): string {
  return BASE;
}

function requireApiKey(): string {
  if (!KEY) {
    throw new Error(
      "EVOLUTION_API_KEY nao configurada no servidor. Adicione no .env.local (EnvironmentFile do systemd).",
    );
  }
  return KEY;
}

/** Erro com status HTTP e corpo original (truncado) pra debug. */
export class EvolutionError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: string,
  ) {
    super(`Evolution API ${status}: ${body.slice(0, 200)}`);
    this.name = "EvolutionError";
  }
}

export type EvolutionState = "open" | "close" | "connecting";

export interface EvolutionInstance {
  instanceName: string;
  instanceId?: string;
  status?: EvolutionState;
  state?: EvolutionState;
  serverUrl?: string;
  apikey?: string;
  ownerJid?: string | null;
  profileName?: string | null;
  profilePicUrl?: string | null;
  integration?: string;
  number?: string | null;
  businessId?: string | null;
  token?: string;
}

export interface EvolutionConnectResponse {
  pairingCode?: string;
  code?: string;
  /**
   * QR code ja em formato data URL completo: `data:image/png;base64,iVBOR...`.
   * A Evolution v2.3.7 prefixa o `data:image/png;base64,` automaticamente
   * — o client NAO deve concatenar o prefixo (gera ERR_INVALID_URL).
   * Use `sanitizeQrSrc()` em @/lib/utils ou o helper local antes de
   * colocar no `<img src=...>`.
   */
  base64?: string;
  /** Alias antigo de algumas versoes. Em v2.3.7 vem vazio. */
  qrcode?: string;
  count?: number;
  instance?: Partial<EvolutionInstance>;
}

/**
 * Normaliza o QR vindo da Evolution pra uso em `<img src>`.
 * Definido em `@/lib/qr` (server+client safe). Re-exportado aqui pra
 * server actions poderem importar de um lugar so.
 */
export { normalizeQrSrc } from "./qr";

/**
 * Fetch helper com timeout 5s + tratamento de erro. Lanca `EvolutionError`
 * em qualquer status >= 400. Caller usa `try/catch` pra acoes idempotentes.
 */
async function evoFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${BASE}${path}`;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 5000);
  try {
    const res = await fetch(url, {
      ...init,
      signal: ctl.signal,
      headers: {
        apikey: requireApiKey(),
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
      cache: "no-store",
    });
    const text = await res.text();
    if (!res.ok) {
      throw new EvolutionError(res.status, text || res.statusText);
    }
    if (!text) return undefined as unknown as T;
    try {
      return JSON.parse(text) as T;
    } catch {
      // Algumas rotas (DELETE) podem responder 200 vazio.
      return undefined as unknown as T;
    }
  } finally {
    clearTimeout(timer);
  }
}

export async function createInstance(name: string): Promise<EvolutionInstance> {
  return evoFetch<EvolutionInstance>("/instance/create", {
    method: "POST",
    body: JSON.stringify({
      instanceName: name,
      qrcode: true,
      integration: "WHATSAPP-BAILEYS",
    }),
  });
}

/** Lista todas as instancias da Evolution (debug/diagnostico). */
export async function fetchInstances(): Promise<EvolutionInstance[]> {
  const data = await evoFetch<unknown>("/instance/fetchInstances");
  if (Array.isArray(data)) return data as EvolutionInstance[];
  // v2.3.7 retorna { instances: [...] } em alguns modos
  if (data && typeof data === "object" && Array.isArray((data as { instances?: unknown[] }).instances)) {
    return (data as { instances: EvolutionInstance[] }).instances;
  }
  return [];
}

export async function connectionState(name: string): Promise<EvolutionInstance> {
  return evoFetch<EvolutionInstance>(
    `/instance/connectionState/${encodeURIComponent(name)}`,
  );
}

export async function connectInstance(
  name: string,
): Promise<EvolutionConnectResponse> {
  return evoFetch<EvolutionConnectResponse>(
    `/instance/connect/${encodeURIComponent(name)}`,
  );
}

export async function logoutInstance(name: string): Promise<void> {
  await evoFetch<unknown>(`/instance/logout/${encodeURIComponent(name)}`, {
    method: "DELETE",
  });
}

export async function deleteInstance(name: string): Promise<void> {
  await evoFetch<unknown>(`/instance/delete/${encodeURIComponent(name)}`, {
    method: "DELETE",
  });
}

/**
 * Aponta o webhook centralizado `/api/webhooks/evolution` na instancia.
 * O n8n passa a ser alimentado por essa URL (sem duplicar regras por
 * tenant) — vide plano ETAPA 5.
 *
 * IMPORTANTE: a Evolution v2 espera o payload envolto em `{ webhook: {...} }`
 * (sem isso, 400 "instance requires property webhook"). Os nomes de evento
 * sao UPPER_SNAKE_CASE — `messages.upsert` lowercase retorna 400 "is not
 * one of enum values". Lista completa vem no probe.
 */
export async function setWebhook(
  name: string,
  webhookUrl: string,
  events: string[] = [
    "MESSAGES_UPSERT",
    "CONNECTION_UPDATE",
    "QRCODE_UPDATED",
    "SEND_MESSAGE",
  ],
): Promise<unknown> {
  return evoFetch<unknown>(`/webhook/set/${encodeURIComponent(name)}`, {
    method: "POST",
    body: JSON.stringify({
      webhook: {
        url: webhookUrl,
        enabled: true,
        events,
        webhook_by_events: false,
      },
    }),
  });
}
