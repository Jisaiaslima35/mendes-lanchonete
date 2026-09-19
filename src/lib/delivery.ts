/**
 * Cálculo de frete por distância (Haversine).
 *
 * Fontes externas (todas gratuitas, sem chave):
 *  - ViaCEP  → https://viacep.com.br/ws/<cep>/json/      (lookup do CEP)
 *  - Nominatim (OpenStreetMap) → /search?format=json      (geocoding do endereço)
 *
 * Regras (Mendes v1):
 *   • Base: R$ 2,00 para até 1 km
 *   • Adicional: + R$ 1,00 / km acima de 1 km
 *   • Teto:  R$ 4,00 (cap obrigatório)
 *   • Fallback: R$ 3,00 se CEP / geocoding falhar
 *
 * Hospedagem: as funções de rede recebem `fetchDep` para rodar
 *   - no Node (route handler / server action) com fetch nativo
 *   - em testes / futuro uso offline, com stub
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { onlyDigits, round2 } from "@/lib/utils";

// ====================================================================
// Tipos públicos
// ====================================================================

export interface StoreLocation {
  cep: string; // apenas dígitos
  lat: number;
  lng: number;
}

export interface AddressFromCep {
  cep: string; // apenas dígitos
  logradouro: string;
  bairro: string;
  cidade: string;
  uf: string;
}

export interface DeliveryQuoteInput {
  cep: string; // apenas dígitos, 8 chars
  store: StoreLocation;
}

export type DeliveryQuoteSource = "distance" | "neighborhood" | "fallback";

export interface DeliveryQuote {
  ok: boolean;
  source: DeliveryQuoteSource;
  address: AddressFromCep | null;
  distance_km: number | null;
  delivery_fee: number; // sempre preenchido (mesmo em fallback)
  reason?: string; // motivo da fallback
}

// ====================================================================
// Constantes de pricing (Mendes v1)
// ====================================================================

export const BASE_FEE = 2.0; // reais
export const FEE_PER_EXTRA_KM = 1.0; // reais por km acima da base
export const FEE_BASE_KM = 1.0; // km inclusos na base
export const FEE_CAP = 4.0; // teto máximo
export const FALLBACK_FEE = 3.0; // taxa default quando o CEP falha
export const EARTH_RADIUS_KM = 6371;

// ====================================================================
// Haversine (pura — não depende de rede / estado global)
// ====================================================================

const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Distância em km entre dois pontos (lat/lng decimal). Fórmula de Haversine. */
export function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

/**
 * Regra de preço Mendes v1:
 *   até `FEE_BASE_KM` km → BASE_FEE
 *   cada km adicional → + FEE_PER_EXTRA_KM
 *   nunca acima de FEE_CAP
 *
 * Recebe km já arredondado em 2 casas (regra de tela).
 */
export function calcDeliveryFeeByDistance(km: number): number {
  const kmAdicional = Math.max(0, round2(km) - FEE_BASE_KM);
  const raw = BASE_FEE + round2(kmAdicional) * FEE_PER_EXTRA_KM;
  return round2(Math.min(raw, FEE_CAP));
}

/** Tela: "X km" formatado com 1 casa se não for inteiro. */
export function formatDistanceKm(km: number | null | undefined): string {
  if (km == null || !Number.isFinite(km)) return "—";
  const r = round2(km);
  if (Number.isInteger(r)) return `${r} km`;
  return `${r.toFixed(1)} km`;
}

// ====================================================================
// Lookups externos (CEP / geocoding) — fetch injetado
// ====================================================================

const NOMINATIM_HEADERS = {
  // Identificador obrigatório da política de uso do Nominatim.
  "User-Agent": "MendesLanchonete/1.0 (contato: automacaojs.us)",
  "Accept-Language": "pt-BR,pt;q=0.9",
  Accept: "application/json",
};

/** Limpa o CEP pra 8 dígitos; retorna vazio se inválido. */
export function normalizeCep(input: string): string {
  return onlyDigits(input).slice(0, 8);
}

/**
 * Lookup ViaCEP.
 * Retorna `null` em falha (CEP inexistente, rede offline, formato inválido).
 */
export async function lookupCep(
  cep: string,
  fetchDep: typeof fetch = fetch,
  signal?: AbortSignal,
): Promise<AddressFromCep | null> {
  const c = normalizeCep(cep);
  if (c.length !== 8) return null;
  const url = `https://viacep.com.br/ws/${c}/json/`;

  let json: unknown;
  try {
    const res = await fetchDep(url, {
      signal,
      headers: { Accept: "application/json" },
      // Next 16 / Node 20: explícito para não cachear por engano.
      cache: "no-store",
    });
    if (!res.ok) return null;
    json = await res.json();
  } catch {
    return null;
  }

  if (!json || typeof json !== "object") return null;
  const v = json as Record<string, unknown>;
  if (v.erro === true || v.erro === "true") return null;
  const logradouro = typeof v.logradouro === "string" ? v.logradouro.trim() : "";
  const bairro = typeof v.bairro === "string" ? v.bairro.trim() : "";
  const cidade = typeof v.localidade === "string" ? v.localidade.trim() : "";
  const uf = typeof v.uf === "string" ? v.uf.trim() : "";
  if (!cidade || !uf) return null;

  return { cep: c, logradouro, bairro, cidade, uf };
}

/**
 * Geocoding Nominatim (OpenStreetMap).
 * - Estratégia 1: busca por CEP puro (algumas cidades mapeiam direto)
 * - Estratégia 2: busca por "logradouro, bairro, cidade/UF, Brasil"
 *
 * Retorna coordenadas {lat, lng} ou `null` se não achar.
 */
export async function geocodeAddress(
  address: AddressFromCep,
  fetchDep: typeof fetch = fetch,
  signal?: AbortSignal,
): Promise<{ lat: number; lng: number } | null> {
  const queries: string[] = [];
  if (address.cep) queries.push(address.cep);
  // Ordem importa: Nominatim pontua logradouro > bairro > cidade.
  const parts = [address.logradouro, address.bairro, `${address.cidade}/${address.uf}`, "Brasil"]
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length) queries.push(parts.join(", "));

  for (const q of queries) {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`;
    try {
      const res = await fetchDep(url, { signal, headers: NOMINATIM_HEADERS, cache: "no-store" });
      if (!res.ok) continue;
      const json = (await res.json()) as unknown;
      if (!Array.isArray(json) || json.length === 0) continue;
      const hit = json[0] as Record<string, unknown>;
      const lat = Number(hit.lat);
      const lng = Number(hit.lon);
      if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
    } catch {
      // continua pra próxima tentativa
    }
  }
  return null;
}

// ====================================================================
// Orquestrador: faz tudo (lookup → geocoding → distância → preço)
// ====================================================================

/**
 * Calcula o frete completo para um CEP de entrega.
 * Sempre retorna um `DeliveryQuote` com `delivery_fee` preenchido
 * (usa `FALLBACK_FEE` se a cadeia falhar).
 */
export async function quoteDelivery(
  input: DeliveryQuoteInput,
  fetchDep: typeof fetch = fetch,
  signal?: AbortSignal,
): Promise<DeliveryQuote> {
  const { store } = input;
  const cep = normalizeCep(input.cep);

  if (cep.length !== 8) {
    return {
      ok: false,
      source: "fallback",
      address: null,
      distance_km: null,
      delivery_fee: FALLBACK_FEE,
      reason: "cep_invalido",
    };
  }

  const address = await lookupCep(cep, fetchDep, signal);
  if (!address) {
    return {
      ok: false,
      source: "fallback",
      address: null,
      distance_km: null,
      delivery_fee: FALLBACK_FEE,
      reason: "viacep_falhou",
    };
  }

  const coord = await geocodeAddress(address, fetchDep, signal);
  if (!coord) {
    return {
      ok: false,
      source: "fallback",
      address,
      distance_km: null,
      delivery_fee: FALLBACK_FEE,
      reason: "nominatim_falhou",
    };
  }

  const distance_km = round2(
    haversineKm(
      { lat: store.lat, lng: store.lng },
      { lat: coord.lat, lng: coord.lng },
    ),
  );
  const fee = calcDeliveryFeeByDistance(distance_km);

  return {
    ok: true,
    source: "distance",
    address,
    distance_km,
    delivery_fee: fee,
  };
}

/**
 * Lê a localização da loja a partir do processo (envs). DEPRECADO em 16/09:
 * cada tenant agora tem lat/lng/cep na própria `settings` (migration
 * 2026-09-16_store_coords_pix.sql). Use `readStoreLocationForTenant(db, tenantId)`.
 *
 * Mantido como fallback de segurança pra deploys que ainda não backfillaram
 * as settings (ex: rodar o dev local sem ter rodado a migration). NÃO use em
 * código novo — se a rota é multi-tenant, é obrigatório ler por tenant.
 */
export function readStoreLocationFromEnv(): StoreLocation {
  const cep = normalizeCep(process.env.STORE_CEP ?? "");
  const lat = Number(process.env.STORE_LAT);
  const lng = Number(process.env.STORE_LNG);
  if (cep.length !== 8) throw new Error("STORE_CEP ausente ou inválido (esperado 8 dígitos).");
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new Error("STORE_LAT/STORE_LNG ausentes ou inválidos.");
  }
  return { cep, lat, lng };
}

/**
 * Lê a localização da loja do `settings` do tenant ativo.
 * Retorna `null` se o admin ainda não preencheu as coordenadas — nesse
 * caso o caller deve cair pra FALLBACK_FEE (R$3) em vez de quebrar o
 * checkout. Lote 1 auditoria: isola STORE_LAT/LNG por tenant.
 */
type TenantSettingsRow = {
  store_lat: number | string | null;
  store_lng: number | string | null;
  store_cep: string | null;
};

/**
 * Aceita qualquer cliente Supabase com permissão de leitura em `settings`
 * (admin Supabase ou service_role bypassando RLS). Em produção multi-tenant
 * use sempre o `tenantId` do request atual — NUNCA outro tenant.
 */
export async function readStoreLocationForTenant(
  db: SupabaseClient,
  tenantId: string,
): Promise<StoreLocation | null> {
  const { data, error } = await db
    .from("settings")
    .select("store_lat, store_lng, store_cep")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (error || !data) return null;
  const row = data as TenantSettingsRow;

  const cep = normalizeCep(row.store_cep ?? "");
  const lat = row.store_lat == null ? NaN : Number(row.store_lat);
  const lng = row.store_lng == null ? NaN : Number(row.store_lng);

  if (cep.length !== 8) return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  return { cep, lat, lng };
}
