"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/supabase/server";
import { getCurrentTenantId } from "@/lib/tenant";
import { orderStatusSchema } from "@/lib/validation/admin";
import { actionError, actionOk, toUserMessage, type ActionResult } from "@/lib/errors";
import { ensureBrazilianPhone, sendDispatchToN8N } from "@/lib/n8n";

export async function updateOrderStatus(orderId: string, status: string): Promise<ActionResult> {
  const parsed = orderStatusSchema.safeParse({ orderId, status });
  if (!parsed.success) return actionError("Status inválido.");

  try {
    const supabase = await createServerSupabase();
    const tenantId = await getCurrentTenantId();

    const { data, error } = await supabase
      .from("orders")
      .update({ status: parsed.data.status })
      .eq("id", parsed.data.orderId)
      .eq("tenant_id", tenantId)
      .select("id");

    if (error) {
      console.error("[admin-orders] update status falhou", {
        orderId: parsed.data.orderId,
        tenantId,
        error,
      });
      return actionError(toUserMessage(error));
    }

    if (!data || data.length === 0) {
      console.warn("[admin-orders] update não afetou nenhuma linha", {
        orderId: parsed.data.orderId,
        tenantId,
      });
      return actionError("Pedido não encontrado ou sem permissão.");
    }

    // Disparo fire-and-forget: notifica o cliente no WhatsApp quando
    // o pedido for marcado como "saiu pra entrega". Erros do webhook
    // NÃO devem bloquear a mudança visual no Kanban — por isso `void`
    // e `await` está só dentro da helper, não aqui.
    if (parsed.data.status === "saiu_entrega") {
      void notifyClientDispatch(supabase, parsed.data.orderId);
    }

    revalidatePath("/admin/pedidos");
    return actionOk();
  } catch (err) {
    console.error("[admin-orders] update status exception", err);
    return actionError(toUserMessage(err));
  }
}

async function notifyClientDispatch(
  supabase: Awaited<ReturnType<typeof createServerSupabase>>,
  orderId: string,
): Promise<void> {
  try {
    const { data, error } = await supabase
      .from("orders")
      .select(
        "order_number, customer_name, customer_phone, fulfillment, address_street, address_number, address_complement, address_district, neighborhood_name, address_reference",
      )
      .eq("id", orderId)
      .maybeSingle();

    if (error || !data) {
      console.warn("[admin-orders] notifyClientDispatch: fetch falhou", { orderId, error });
      return;
    }

    const orderLabel = `#${data.order_number}`;

    // Pedidos de retirada não têm endereço de entrega — manda mensagem genérica.
    let delivery_address = "Retirada no balcão";
    if (data.fulfillment === "delivery") {
      const parts = [
        data.address_street && data.address_number
          ? `${data.address_street}, ${data.address_number}`
          : data.address_street ?? null,
        data.address_complement ? data.address_complement : null,
        data.address_district ?? null,
        data.neighborhood_name ?? null,
      ].filter((s): s is string => Boolean(s && s.trim()));
      delivery_address = parts.length > 0 ? parts.join(" — ") : "Endereço não informado";
    }

    await sendDispatchToN8N({
      source: "mendes_teste",
      order_id: orderLabel,
      customer_name: data.customer_name,
      customer_phone: ensureBrazilianPhone(data.customer_phone ?? ""),
      delivery_address,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn("[admin-orders] notifyClientDispatch exception", { orderId, error: msg });
  }
}

export async function updatePaymentStatus(
  orderId: string,
  paymentStatus: "pending" | "confirmed" | "failed",
): Promise<ActionResult> {
  try {
    const supabase = await createServerSupabase();

    const { error } = await supabase
      .from("orders")
      .update({ payment_status: paymentStatus })
      .eq("id", orderId);

    if (error) return actionError(toUserMessage(error));

    revalidatePath("/admin/pedidos");

    return actionOk();
  } catch (err) {
    return actionError(toUserMessage(err));
  }
}