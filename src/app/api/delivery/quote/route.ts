import { NextResponse, type NextRequest } from "next/server";
import {
  quoteDelivery,
  readStoreLocationForTenant,
  FALLBACK_FEE,
  type DeliveryQuote,
} from "@/lib/delivery";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { getCurrentTenantId } from "@/lib/tenant";

/**
 * GET /api/delivery/quote?cep=<8digitos>
 *
 * Calcula o frete a partir da distância em linha reta (Haversine) entre
 * a loja DO TENANT ATIVO (settings.store_lat / store_lng / store_cep) e o
 * CEP de entrega do cliente. Lote 1 auditoria: cada tenant usa SUAS
 * coordenadas — não mais STORE_LAT/STORE_LNG global do .env.
 *
 * Fontes: ViaCEP + Nominatim (gratuitas, sem chave).
 * Teto: R$ 4,00. Fallback: R$ 3,00 se rede/CEP/geocoding/store-null falhar.
 *
 * Resposta: shape `DeliveryQuote`. Sempre retorna 200 com `ok:false`
 * em fallback pra UI exibir a taxa default sem quebrar.
 */

// Limite duro pra chamada externa. Nominatim impõe ~1 req/s.
const TIMEOUT_MS = 4500;

// Cacheia pouco — CEP novo a cada pedido é normal, mas se o cliente
// re-abrir o checkout no mesmo CEP não queremos bater 2x.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest): Promise<NextResponse<DeliveryQuote>> {
  const cepParam = req.nextUrl.searchParams.get("cep") ?? "";
  const debug = req.nextUrl.searchParams.get("debug") === "1";

  const tenantId = await getCurrentTenantId();
  const db = createAdminSupabase();
  const store = await readStoreLocationForTenant(db, tenantId);

  if (!store) {
    // Admin ainda não preencheu lat/lng/cep nas settings desta loja.
    // Não quebra o cliente — UI mostra o FALLBACK_FEE (R$ 3) sem mudar UX.
    return NextResponse.json(
      {
        ok: false,
        source: "fallback",
        address: null,
        distance_km: null,
        delivery_fee: FALLBACK_FEE,
        reason: "store_unconfigured",
      } satisfies DeliveryQuote,
      { status: 200 },
    );
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const quote = await quoteDelivery(
      { cep: cepParam, store },
      fetch,
      controller.signal,
    );
    if (!debug) {
      return NextResponse.json(quote, { status: 200 });
    }
    return NextResponse.json({ ...quote, _debug: { store, tenant_id: tenantId } }, { status: 200 });
  } catch (err) {
    const reason = err instanceof Error ? err.name : "unknown";
    return NextResponse.json(
      {
        ok: false,
        source: "fallback",
        address: null,
        distance_km: null,
        delivery_fee: FALLBACK_FEE,
        reason: `exception:${reason}`,
      } satisfies DeliveryQuote,
      { status: 200 },
    );
  } finally {
    clearTimeout(timer);
  }
}
