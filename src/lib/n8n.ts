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
 *
 * Lote 1 auditoria SaaS — item 3 (roteamento WhatsApp/n8n isolado):
 * - `source` virou genérico ("mendes") — n8n identifica o tenant por
 *   `tenant_slug` (UNIQUE no DB), não por source hardcoded.
 * - `evolution_instance_name` = tenants.slug (instância WhatsApp DONA
 *   do envio — o bot do n8n fala com a Evolution API dessa instância).
 * - `store_whatsapp` = settings.whatsapp_number do tenant (telefone do
 *   dono da loja, pra onde o alerta "tem pedido novo" chega).
 * - `customer_phone` permanece o telefone do cliente (já com DDI 55).
 *   É isso que o n8n usa pra mandar a confirmação final pro cliente.
 */
export type OrderN8NPayload = {
  source: "mendes";
  tenant_id: string;
  tenant_slug: string;
  evolution_instance_name: string | null;
  store_whatsapp: string | null;
  order_id: string;
  short_id: string;
  customer: {
    name: string;
    phone: string;
    email: string | null;
  };
  delivery_address: {
    fulfillment: "delivery" | "pickup" | "mesa";
    street: string | null;
    number: string | null;
    complement: string | null;
    district: string | null;
    neighborhood: string | null;
    zip: string | null;
    reference: string | null;
    mesa: string | null;
  } | null;
  notes: string | null;
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
    /**
     * Valor da nota em dinheiro que o cliente vai pagar (só preenchido
     * quando payment.method === "cash" e o cliente quer troco). Lote 2
     * item 2: motoboy/cozinha precisam saber quanto levar.
     */
    change_for: number | null;
  };
};

/**
 * Input mínimo pra construir o payload do n8n. O caller (checkout /
 * webhook MP) carrega essas infos a partir do `settings` + `tenants`
 * do tenant ativo — NUNCA do .env.
 */
export type OrderN8NContext = {
  tenant_id: string;
  tenant_slug: string;
  evolution_instance_name: string | null;
  store_whatsapp: string | null;
};

export function buildOrderPayload(
  order: Order,
  items: OrderItem[],
  ctx: OrderN8NContext,
): OrderN8NPayload {
  return {
    source: "mendes",
    tenant_id: ctx.tenant_id,
    tenant_slug: ctx.tenant_slug,
    evolution_instance_name: ctx.evolution_instance_name,
    store_whatsapp: ctx.store_whatsapp,
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
            mesa: null,
          }
        : order.fulfillment === "mesa"
          ? {
              fulfillment: "mesa",
              street: null,
              number: null,
              complement: null,
              district: null,
              neighborhood: null,
              zip: null,
              reference: null,
              mesa: order.mesa,
            }
          : {
              fulfillment: "pickup",
              street: null,
              number: null,
              complement: null,
              district: null,
              neighborhood: null,
              zip: null,
              reference: null,
              mesa: null,
            },
    notes: order.notes,
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
      change_for: order.change_for ?? null,
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
 *
 * Lote 1 auditoria — mesmo isolamento do payload de pedido: tenant_slug
 * identifica qual instância Evolution roteia; customer_phone é o telefone
 * final do cliente (não o da loja, não hardcoded).
 */
export type DispatchN8NPayload = {
  source: "mendes";
  tenant_id: string;
  tenant_slug: string;
  evolution_instance_name: string | null;
  store_whatsapp: string | null;
  order_id: string;       // já formatado (#0011)
  customer_name: string;
  customer_phone: string; // DDI 55 garantido — telefone do CLIENTE
  modality: "delivery" | "pickup" | "mesa";
  delivery_address: string; // texto livre (delivery=endereço completo, pickup='Retirada no balcão', mesa='Mesa X')
  mesa: string | null;      // preenchido quando modality='mesa'
  payment_method: "pix" | "cash" | "card";
  /**
   * Lote 2 item 2: troco em dinheiro. Valor da nota que o cliente vai pagar
   * (`change_for`) e o quanto o motoboy precisa devolver (`cash_change_amount`).
   * Ambos null quando o pagamento não é dinheiro, OU quando é dinheiro mas
   * o pagamento é exato (sem troco).
   */
  change_for: number | null;
  cash_change_amount: number | null;
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

/**
 * Repasse de evento inbound vindo da Evolution API (mensagem recebida,
 * atualizacao de conexao, QR rotacionado). POSTa o JSON cru pro mesmo
 * webhook de pedido — o n8n identifica `source: "evolution"` e roteia
 * internamente sem precisar de uma URL por tenant.
 *
 * Pensado pra ser chamado dentro do handler `POST /api/webhooks/evolution`
 * via `void forwardEvolutionEvent(...)`. Fire-and-forget com timeout curto.
 */
export async function forwardEvolutionEvent(
  payload: Record<string, unknown>,
): Promise<void> {
  const url = process.env.N8N_ORDER_WEBHOOK_URL?.trim();
  if (!url) return; // no-op silencioso

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
        "[n8n] evolution webhook respondeu erro",
        { status: res.status, event: payload.event, instance: payload.instance },
      );
      return;
    }

    console.info("[n8n] evolution event forwarded", {
      event: payload.event,
      instance: payload.instance,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(
      "[n8n] falha ao repassar evento evolution (ignorada)",
      { event: payload.event, instance: payload.instance, error: msg },
    );
  } finally {
    clearTimeout(timer);
  }
}
