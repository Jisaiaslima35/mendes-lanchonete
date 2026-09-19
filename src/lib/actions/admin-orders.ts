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
      void notifyClientDispatch(supabase, parsed.data.orderId, tenantId);
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
  tenantId: string,
): Promise<void> {
  try {
    // Busca paralela: dados do pedido + contexto do tenant (slug, instância
    // Evolution, whatsapp da loja). Sem o contexto do tenant o n8n não sabe
    // pra QUAL instância Evolution rotear a notificação — Lote 1 item 3.
    const [{ data: orderData, error: orderErr }, { data: tenantData, error: tenantErr }, { data: settingsData, error: settingsErr }] = await Promise.all([
      supabase
        .from("orders")
        .select(
          "order_number, customer_name, customer_phone, payment_method, change_for, total, fulfillment, mesa, address_street, address_number, address_complement, address_district, neighborhood_name, address_reference",
        )
        .eq("id", orderId)
        .maybeSingle(),
      supabase
        .from("tenants")
        .select("id, slug, evolution_instance_name")
        .eq("id", tenantId)
        .maybeSingle(),
      supabase
        .from("settings")
        .select("whatsapp_number")
        .eq("tenant_id", tenantId)
        .maybeSingle(),
    ]);

    if (orderErr || !orderData) {
      console.warn("[admin-orders] notifyClientDispatch: fetch order falhou", { orderId, error: orderErr });
      return;
    }
    if (tenantErr || !tenantData) {
      console.warn("[admin-orders] notifyClientDispatch: fetch tenant falhou", { tenantId, error: tenantErr });
      return;
    }

    // order_number já vem com "#" do banco (ex: "#0030"). Não duplica.
    const orderLabel = orderData.order_number.startsWith("#")
      ? orderData.order_number
      : `#${orderData.order_number}`;
    const modality = orderData.fulfillment as "delivery" | "pickup" | "mesa";
    const paymentMethod = orderData.payment_method as "pix" | "cash" | "card";

    // Texto descritivo da entrega/retirada/mesa pro webhook n8n escolher o template.
    let delivery_address = "Retirada no balcão";
    if (orderData.fulfillment === "delivery") {
      const parts = [
        orderData.address_street && orderData.address_number
          ? `${orderData.address_street}, ${orderData.address_number}`
          : orderData.address_street ?? null,
        orderData.address_complement ? orderData.address_complement : null,
        orderData.address_district ?? null,
        orderData.neighborhood_name ?? null,
      ].filter((s): s is string => Boolean(s && s.trim()));
      delivery_address = parts.length > 0 ? parts.join(" — ") : "Endereço não informado";
    } else if (orderData.fulfillment === "mesa") {
      delivery_address = `Mesa ${orderData.mesa ?? "?"}`;
    }

    // Troco em dinheiro: só preenche quando payment=cash E change_for > total
    // (pagamento exato não precisa de troco). Lote 2 item 2: motoboy sabe
    // quanto levar + quanto devolver.
    const changeForRaw = orderData.change_for as number | null | undefined;
    const total = orderData.total as number;
    const changeFor = paymentMethod === "cash" && typeof changeForRaw === "number" ? changeForRaw : null;
    const cashChangeAmount =
      changeFor != null && changeFor > total ? changeFor - total : null;

    const dispatchPayload = {
      source: "mendes" as const,
      tenant_id: tenantData.id,
      tenant_slug: tenantData.slug,
      evolution_instance_name: tenantData.evolution_instance_name ?? null,
      store_whatsapp: settingsData?.whatsapp_number ?? null,
      order_id: orderLabel,
      customer_name: orderData.customer_name,
      customer_phone: ensureBrazilianPhone(orderData.customer_phone ?? ""),
      modality,
      delivery_address,
      mesa: orderData.fulfillment === "mesa" ? (orderData.mesa ?? null) : null,
      payment_method: paymentMethod,
      change_for: changeFor,
      cash_change_amount: cashChangeAmount,
    };

    // Log explícito ANTES de bater no n8n pra ficar fácil auditar via
    // journalctl. JSON completo + URL destino — Isaías pediu auditoria total
    // em msg 4900 (22/09: roteamento Evolution vs formiga).
    console.log("[EVOLUTION DISPATCH] payload completo enviado ao n8n", JSON.stringify(dispatchPayload));
    console.log("[EVOLUTION DISPATCH] webhook_url", process.env.N8N_DISPATCH_WEBHOOK_URL?.trim() ?? "<unset>");

    await sendDispatchToN8N(dispatchPayload);
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