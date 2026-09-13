import "server-only";

import type { Order, OrderItem } from "@/types/database";

/**
 * Disparo fire-and-forget pra webhook do n8n com o JSON completo do pedido.
 *
 * Pensado pra ser chamado logo após o INSERT em `orders` (cash/card) ou
 * logo após o webhook do MercadoPago virar o status pra `confirmado` (Pix).
 *
 * Contratos:
 * - Se `N8N_ORDER_WEBHOOK_URL` não estiver configurado OU for string vazia,
 *   vira no-op (não loga, não falha o fluxo principal).
 * - Timeout de 5s via AbortController. Não bloqueia o caller — dispara e
 *   esquece via `void sendOrderToN8N(...)`.
 * - Em caso de erro (rede, 5xx, timeout), apenas loga em stderr. Erros
 *   do webhook n8n NÃO devem quebrar checkout nem webhook do MP.
 */
export type OrderN8NPayload = {
  source: "mendes_teste";
  order_id: string;
  short_id: string;
  customer: {
    name: string;
    phone: string;
    email: string | null;
  };
  delivery_address: {
    fulfillment: "delivery" | "pickup";
    street: string | null;
    number: string | null;
    complement: string | null;
    district: string | null;
    neighborhood: string | null;
    zip: string | null;
    reference: string | null;
  } | null;
  items: {
    quantity: number;
    name: string;
    unit_price: number;
    options: { group: string; name: string; price_delta: number }[];
    notes: string | null;
    line_total: number;
  }[];
  totals: {
    subtotal: number;
    delivery_fee: number;
    discount: number;
    total: number;
  };
  payment: {
    method: "pix" | "cash" | "card";
    status: "pending" | "confirmed" | "failed";
    transaction_id: string | null;
    paid_at: string | null;
  };
};

export function buildOrderPayload(
  order: Order,
  items: OrderItem[],
): OrderN8NPayload {
  return {
    source: "mendes_teste",
    order_id: order.id,
    short_id: order.order_number,
    customer: {
      name: order.customer_name,
      phone: order.customer_phone,
      email: order.customer_email,
    },
    delivery_address:
      order.fulfillment === "delivery"
        ? {
            fulfillment: "delivery",
            street: order.address_street,
            number: order.address_number,
            complement: order.address_complement,
            district: order.address_district,
            neighborhood: order.neighborhood_name,
            zip: order.address_zip,
            reference: order.address_reference,
          }
        : { fulfillment: "pickup", street: null, number: null, complement: null, district: null, neighborhood: null, zip: null, reference: null },
    items: items.map((it) => ({
      quantity: it.quantity,
      name: it.product_name,
      unit_price: it.unit_price,
      options: it.options.map((o) => ({
        group: o.groupName,
        name: o.optionName,
        price_delta: o.priceDelta,
      })),
      notes: it.notes,
      line_total: it.line_total,
    })),
    totals: {
      subtotal: order.items_total,
      delivery_fee: order.delivery_fee,
      discount: order.discount,
      total: order.total,
    },
    payment: {
      method: order.payment_method,
      status: order.payment_status,
      transaction_id: order.payment_transaction_id,
      paid_at: order.payment_paid_at,
    },
  };
}

/**
 * Faz POST do payload pra N8N_ORDER_WEBHOOK_URL.
 * - Resolve a Promise interna (sem lançar erro pro caller).
 * - Caller deve usar `void sendOrderToN8N(...)`.
 */
export async function sendOrderToN8N(payload: OrderN8NPayload): Promise<void> {
  const url = process.env.N8N_ORDER_WEBHOOK_URL?.trim();
  if (!url) return; // no-op silencioso se não configurado

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!res.ok) {
      console.warn(
        "[n8n] webhook respondeu erro",
        { status: res.status, orderId: payload.order_id },
      );
      return;
    }

    console.info("[n8n] pedido enviado com sucesso", {
      orderId: payload.order_id,
      shortId: payload.short_id,
      method: payload.payment.method,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(
      "[n8n] falha ao enviar pedido (ignorada)",
      { orderId: payload.order_id, error: msg },
    );
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Disparo de "saiu pra entrega" — notifica o cliente via WhatsApp.
 *
 * Pensado pra ser chamado dentro da Server Action `updateOrderStatus`
 * quando o novo status for `saiu_entrega`. Fire-and-forget com timeout
 * curto; erros NÃO devem bloquear a mudança visual no Kanban.
 */
export type DispatchN8NPayload = {
  source: "mendes_teste";
  order_id: string;       // já formatado (#0011)
  customer_name: string;
  customer_phone: string; // DDI 55 garantido
  delivery_address: string;
};

/**
 * Garante DDI 55 no telefone. Aceita string com qualquer formatação
 * (parênteses, espaços, traços). Se já tiver 12-13 dígitos com 55,
 * devolve como está.
 */
export function ensureBrazilianPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 0) return phone;
  if (digits.startsWith("55") && digits.length >= 12) return digits;
  return `55${digits}`;
}

export async function sendDispatchToN8N(
  payload: DispatchN8NPayload,
): Promise<void> {
  const url = process.env.N8N_DISPATCH_WEBHOOK_URL?.trim();
  if (!url) return; // no-op silencioso se não configurado

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!res.ok) {
      console.warn(
        "[n8n] dispatch webhook respondeu erro",
        { status: res.status, orderId: payload.order_id },
      );
      return;
    }

    console.info("[n8n] dispatch enviado com sucesso", {
      orderId: payload.order_id,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(
      "[n8n] falha ao enviar dispatch (ignorada)",
      { orderId: payload.order_id, error: msg },
    );
  } finally {
    clearTimeout(timer);
  }
}
