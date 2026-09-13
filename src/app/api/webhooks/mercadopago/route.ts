import { NextResponse } from "next/server";
import { Payment } from "mercadopago";
import { getMercadoPago } from "@/lib/mercadopago";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { buildOrderPayload, sendOrderToN8N } from "@/lib/n8n";

// Webhook público do MercadoPago — recebe notificações IPN/webhook de mudança de status
// de pagamento Pix (e eventualmente cartão).
//
// REGRA DE OURO: sempre retornar 200, mesmo em erro. O MP reenvia notificações
// com falha até bater limite e banir a URL. Idempotência garantida via filtro
// de status no UPDATE (só roda se o pedido não estiver em estado terminal).
//
// TODO(segurança): adicionar validação de assinatura HMAC via header
// `x-signature` antes de processar. Por ora confiamos na obscuridade da URL
// — suficiente pra test mode + cardápio único. Antes de ir pra produção real,
// é obrigatório validar.
//
// Mapeamento de status MP → enum order_status do schema:
//   approved               → confirmado (cliente pagou; loja preparar)
//   rejected | cancelled   → cancelado  (Pix expirado / rejeitado pelo banco)
//   in_process | pending | authorized | in_mediation →  noop (cliente ainda pagando)
type MpStatus =
  | "approved"
  | "rejected"
  | "cancelled"
  | "in_process"
  | "pending"
  | "authorized"
  | "in_mediation"
  | "refunded"
  | "charged_back";

type OrderStatus = "confirmado" | "cancelado";

function mapMpStatus(mp: MpStatus): OrderStatus | null {
  if (mp === "approved") return "confirmado";
  if (mp === "rejected" || mp === "cancelled") return "cancelado";
  return null;
}

type ParsedWebhook =
  | { kind: "skip"; reason: string }
  | { kind: "v1"; paymentId: number }
  | { kind: "legacy"; paymentId: number };

// Aceita os formatos de webhook que o MP manda em paralelo:
//   v1:    { type: "payment", data: { id: 12345 } }
//   IPN:   { topic: "payment", resource: "https://api.mercadopago.com/.../payments/12345" }
//   IPN-nu:{ topic: "payment", resource: "12345" }   ← resource é ID puro, sem URL
function parseWebhookBody(raw: unknown): ParsedWebhook {
  const body = raw as Record<string, unknown> | null;
  if (!body || typeof body !== "object") {
    return { kind: "skip", reason: "body_nao_objeto" };
  }

  const v1Type = body.type;
  const dataId = (body.data as Record<string, unknown> | undefined)?.id;
  if (v1Type === "payment" && typeof dataId === "number") {
    return { kind: "v1", paymentId: dataId };
  }
  if (v1Type === "payment" && typeof dataId === "string" && /^\d+$/.test(dataId)) {
    return { kind: "v1", paymentId: Number(dataId) };
  }

  const topic = body.topic;
  const resource = body.resource;
  if (topic === "payment") {
    if (typeof resource === "string") {
      // IPN clássico: resource é URL completa
      const urlMatch = resource.match(/\/payments\/(\d+)/);
      if (urlMatch) return { kind: "legacy", paymentId: Number(urlMatch[1]) };
      // IPN "lean": resource é só o ID numérico puro
      if (/^\d+$/.test(resource)) {
        return { kind: "legacy", paymentId: Number(resource) };
      }
    }
    if (typeof resource === "number") {
      return { kind: "legacy", paymentId: resource };
    }
  }

  return { kind: "skip", reason: "formato_desconhecido" };
}

// Detecta se uma exception veio do SDK do MP com 404 "Payment not found".
// Quando isso acontece o pagamento não existe mais (foi limpo pelo MP, expirou
// em sandbox, ou o id é bogus) — é um caso benigno e não justifica erro vermelho.
function isMpPaymentNotFound(err: unknown): boolean {
  const e = err as { cause?: { status?: number; error?: string }; status?: number; message?: string };
  if (typeof e?.message === "string" && /Payment not found/i.test(e.message)) return true;
  if (e?.cause?.status === 404 && e?.cause?.error === "not_found") return true;
  if (e?.status === 404) return true;
  return false;
}

export async function POST(request: Request) {
  try {
    const raw = await request.json().catch(() => null);
    const parsed = parseWebhookBody(raw);

    if (parsed.kind === "skip") {
      console.warn("[webhook MP] payload ignorado:", parsed.reason, JSON.stringify(raw));
      // MP manda ping de validação — responder 200 pra URL ser considerada viva.
      return NextResponse.json({ ok: true, ignored: parsed.reason }, { status: 200 });
    }

    console.info("[webhook MP] recebido", { kind: parsed.kind, paymentId: parsed.paymentId });

    const mercadoPago = getMercadoPago();
    const client = new Payment(mercadoPago);

    let mpPayment;
    try {
      mpPayment = await client.get({ id: parsed.paymentId });
    } catch (err) {
      if (isMpPaymentNotFound(err)) {
        console.info("[webhook MP] pagamento não existe mais no MP, noop benigno", {
          paymentId: parsed.paymentId,
        });
        return NextResponse.json({ ok: true, ignored: "mp_payment_not_found" }, { status: 200 });
      }
      throw err;
    }

    const status = mpPayment.status as MpStatus | undefined;
    const orderStatus = status ? mapMpStatus(status) : null;

    if (!status || !orderStatus) {
      console.info("[webhook MP] status não terminal, noop", {
        paymentId: parsed.paymentId,
        status,
      });
      return NextResponse.json({ ok: true, noop: true, status }, { status: 200 });
    }

    const orderId = String(mpPayment.external_reference ?? "");
    if (!orderId) {
      console.error("[webhook MP] pagamento sem external_reference", { paymentId: parsed.paymentId });
      return NextResponse.json({ ok: false, error: "external_reference ausente" }, { status: 200 });
    }

    const supabase = createAdminSupabase();
    const nowIso = new Date().toISOString();

    const patch: Record<string, unknown> = {
      status: orderStatus,
      status_updated_at: nowIso,
      payment_provider: "mercadopago",
      payment_transaction_id: String(parsed.paymentId),
    };

    if (orderStatus === "confirmado") {
      patch.payment_paid_at = nowIso;
      patch.payment_status = "confirmed"; // mantém payment_status sincronizado com status
      patch.paid_amount = typeof mpPayment.transaction_amount === "number" ? mpPayment.transaction_amount : null;
    }

    // Só atualiza pedidos que NÃO estejam em estado terminal (entregue/cancelado).
    // Se já entregue/cancelado, retorna 0 rows — segue sendo 200 pro MP.
    const { data: updatedRows, error } = await supabase
      .from("orders")
      .update(patch)
      .eq("id", orderId)
      .not("status", "in", "(entregue,cancelado)")
      .select("id, status, order_number, customer_name, customer_phone, customer_email, fulfillment, address_zip, address_street, address_number, address_complement, address_district, address_reference, neighborhood_name, payment_method, payment_status, payment_transaction_id, payment_paid_at, items_total, delivery_fee, discount, total");

    if (error) {
      console.error("[webhook MP] erro ao atualizar pedido", {
        paymentId: parsed.paymentId,
        orderId,
        error: error.message,
      });
      // 200 mesmo em erro de DB — MP não precisa saber do nosso erro interno.
      return NextResponse.json({ ok: false, error: error.message }, { status: 200 });
    }

    if (!updatedRows || updatedRows.length === 0) {
      console.info("[webhook MP] pedido já em estado terminal, ignored", { orderId });
      return NextResponse.json({ ok: true, ignored: "already_terminal" }, { status: 200 });
    }

    console.info("[webhook MP] pedido atualizado", {
      paymentId: parsed.paymentId,
      orderId,
      newStatus: orderStatus,
      mpStatus: status,
    });

    // Disparo fire-and-forget pro n8n com payload completo do pedido.
    // Pix aprovado = cozinha começa a preparar ⇒ dono precisa ser avisado já.
    if (orderStatus === "confirmado") {
      const updatedOrder = updatedRows[0];
      const { data: items } = await supabase
        .from("order_items")
        .select("id, order_id, product_id, product_name, unit_price, quantity, options, options_total, notes, line_total, created_at")
        .eq("order_id", orderId);

      void sendOrderToN8N(
        buildOrderPayload(
          updatedOrder as unknown as Parameters<typeof buildOrderPayload>[0],
          (items ?? []) as unknown as Parameters<typeof buildOrderPayload>[1],
        ),
      );
    }

    return NextResponse.json({ ok: true, updated: true, status: orderStatus }, { status: 200 });
  } catch (error) {
    console.error("[webhook MP] erro inesperado", error);
    // Qualquer erro não tratado vira 200 com payload de erro. MP reenvia quando
    // recebe <200/2xx — preferir 200 + log é a recomendação oficial deles.
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "erro_desconhecido" },
      { status: 200 },
    );
  }
}

// MP às vezes manda GET (fingerprint/ping) — responder 200 pra URL ser considerada viva.
export async function GET() {
  return NextResponse.json({ ok: true, route: "webhooks/mercadopago" }, { status: 200 });
}
