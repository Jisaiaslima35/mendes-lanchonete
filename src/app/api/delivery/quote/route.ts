import { NextResponse, type NextRequest } from "next/server";
import {
  quoteDelivery,
  readStoreLocationFromEnv,
  type DeliveryQuote,
} from "@/lib/delivery";

/**
 * GET /api/delivery/quote?cep=<8digitos>
 *
 * Calcula o frete a partir da distância em linha reta (Haversine) entre
 * a loja (STORE_LAT/STORE_LNG) e o CEP de entrega do cliente.
 *
 * Fontes: ViaCEP + Nominatim (gratuitas, sem chave).
 * Teto: R$ 4,00. Fallback: R$ 3,00 se rede/CEP/geocoding falhar.
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

  let store;
  try {
    store = readStoreLocationFromEnv();
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        source: "fallback",
        address: null,
        distance_km: null,
        delivery_fee: 3.0,
        reason: `store_unconfigured: ${err instanceof Error ? err.message : String(err)}`,
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
    return NextResponse.json({ ...quote, _debug: { store } }, { status: 200 });
  } catch (err) {
    const reason = err instanceof Error ? err.name : "unknown";
    return NextResponse.json(
      {
        ok: false,
        source: "fallback",
        address: null,
        distance_km: null,
        delivery_fee: 3.0,
        reason: `exception:${reason}`,
      } satisfies DeliveryQuote,
      { status: 200 },
    );
  } finally {
    clearTimeout(timer);
  }
}
