"use server";

import { checkoutSchema, type CheckoutInput } from "@/lib/validation/checkout";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { getCurrentTenantId } from "@/lib/tenant";
import { isStoreOpen } from "@/lib/horario";
import {
  cartTotal,
  effectivePrice,
  itemsSubtotal,
  resolveDeliveryFee,
  resolveDiscount,
  type PricedCartItem,
} from "@/lib/precos";
import { quoteDelivery, readStoreLocationForTenant, FALLBACK_FEE, normalizeCep } from "@/lib/delivery";
import { buildWhatsAppMessage, buildWhatsAppUrl } from "@/lib/whatsapp";
import { buildOrderPayload, sendOrderToN8N } from "@/lib/n8n";
import { actionError, actionOk, logError, toUserMessage, type ActionResult } from "@/lib/errors";
import { buildPixBRCode } from "@/lib/pix/brcode";
import { pixBRCodeToBase64 } from "@/lib/pix/qr";
import type { BusinessHour, Settings } from "@/types/database";

type CheckoutResult = {
  orderId: string;
  orderNumber: string;
  publicToken: string;
  customerEmail: string;
  whatsappUrl: string;
};

export async function submitCheckout(input: CheckoutInput): Promise<ActionResult<CheckoutResult>> {
  const parsed = checkoutSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join(".") || "root";
      fieldErrors[key] = [...(fieldErrors[key] ?? []), issue.message];
    }
    return actionError("Verifique os dados informados.", fieldErrors);
  }
  const data = parsed.data;

  try {
    const tenantId = await getCurrentTenantId();
    const db = createAdminSupabase();

    const [{ data: settings }, { data: hours }, { data: tenant }] = await Promise.all([
      db.from("settings").select("*").eq("tenant_id", tenantId).single(),
      db.from("business_hours").select("*").eq("tenant_id", tenantId),
      db.from("tenants").select("id, slug, evolution_instance_name").eq("id", tenantId).single(),
    ]);
    if (!settings) return actionError("Loja não configurada.");
    if (!tenant) return actionError("Tenant não encontrado.");

    const businessHours = (hours ?? []) as BusinessHour[];
    if (!isStoreOpen(businessHours, (settings as Settings).manual_closed)) {
      return actionError((settings as Settings).closed_message || "A loja está fechada no momento.");
    }

    if (data.fulfillment === "delivery" && !(settings as Settings).accepts_delivery) {
      return actionError("No momento não estamos aceitando entregas.");
    }
    if (data.fulfillment === "pickup" && !(settings as Settings).accepts_pickup) {
      return actionError("No momento não estamos aceitando retirada no local.");
    }
    // Mesa sempre é aceita — só depende do cliente escanear o QR Code.

    const productIds = [...new Set(data.items.map((i) => i.productId))];
    const optionIds = [...new Set(data.items.flatMap((i) => i.optionIds))];

    const { data: products } = await db
      .from("products")
      .select("*, product_option_groups(group_id, option_groups(id, name, selection_type, min_select, max_select, is_required))")
      .eq("tenant_id", tenantId)
      .in("id", productIds);

    const optionsResult =
      optionIds.length > 0
        ? await db.from("options").select("*, option_groups(id, name)").in("id", optionIds)
        : null;
    const options = optionsResult?.data ?? [];

    type ProductGroupLink = {
      group_id: string;
      option_groups: {
        id: string;
        name: string;
        selection_type: string;
        min_select: number;
        max_select: number | null;
        is_required: boolean;
      };
    };
    type ProductRow = {
      id: string;
      name: string;
      price: number;
      promo_price: number | null;
      is_active: boolean;
      is_available: boolean;
      product_option_groups: ProductGroupLink[];
    };
    type OptionRow = {
      id: string;
      group_id: string;
      name: string;
      price_delta: number;
      is_available: boolean;
      option_groups: { id: string; name: string };
    };

    const productMap = new Map((products as unknown as ProductRow[] | null ?? []).map((p) => [p.id, p]));
    const optionMap = new Map((options as unknown as OptionRow[] | null ?? []).map((o) => [o.id, o]));

    const pricedItems: PricedCartItem[] = [];

    for (const item of data.items) {
      const product = productMap.get(item.productId);
      if (!product || !product.is_active) {
        return actionError(`Produto indisponível: verifique seu carrinho.`);
      }
      if (!product.is_available) {
        return actionError(`"${product.name}" está esgotado no momento.`);
      }

      const linkedGroups = product.product_option_groups.map((l) => l.option_groups);
      const selectedOptions = item.optionIds
        .map((id) => optionMap.get(id))
        .filter((o): o is OptionRow => Boolean(o) && linkedGroups.some((g) => g.id === o!.group_id));

      for (const group of linkedGroups) {
        const countInGroup = selectedOptions.filter((o) => o.group_id === group.id).length;
        if (group.is_required && countInGroup < Math.max(1, group.min_select)) {
          return actionError(`Escolha uma opção em "${group.name}" para "${product.name}".`);
        }
        if (group.max_select != null && countInGroup > group.max_select) {
          return actionError(`Você selecionou opções demais em "${group.name}" para "${product.name}".`);
        }
        if (countInGroup > 0) {
          const unavailable = selectedOptions.find((o) => o.group_id === group.id && !o.is_available);
          if (unavailable) {
            return actionError(`"${unavailable.name}" não está mais disponível.`);
          }
        }
      }

      pricedItems.push({
        productId: product.id,
        productName: product.name,
        unitPrice: effectivePrice(product),
        quantity: item.quantity,
        notes: item.notes,
        options: selectedOptions.map((o) => ({
          id: o.id,
          groupName: o.option_groups.name,
          optionName: o.name,
          priceDelta: o.price_delta,
        })),
      });
    }

    const subtotal = itemsSubtotal(pricedItems);
    if (subtotal < (settings as Settings).min_order_value) {
      return actionError(
        `Pedido mínimo de ${(settings as Settings).min_order_value.toFixed(2).replace(".", ",")} não atingido.`,
      );
    }

    let deliveryFee = 0;
    let deliverySource: "distance" | "neighborhood" | "none" = "none";
    let deliveryDistanceKm: number | null = null;
    // Bairro é texto livre agora — gravamos o que o cliente digitou.
    // Mas tentamos casar com a tabela `neighborhoods` pra puxar a taxa
    // de entrega cadastrada quando o cálculo por distância falha.
    let neighborhoodName: string | null = null;
    let neighborhoodId: string | null = null;
    let matchedNeighborhood: {
      id: string;
      name: string;
      delivery_fee: number;
      min_order_value: number;
      free_delivery_threshold: number | null;
    } | null = null;

    if (data.fulfillment === "delivery") {
      neighborhoodName = data.address!.district.trim();
      const districtLower = neighborhoodName.toLowerCase();
      const { data: candidateRows } = await db
        .from("neighborhoods")
        .select("id, name, delivery_fee, min_order_value, free_delivery_threshold")
        .eq("tenant_id", tenantId)
        .eq("is_active", true);
      matchedNeighborhood =
        (candidateRows ?? []).find(
          (n) => n.name.trim().toLowerCase() === districtLower,
        ) ?? null;
      if (matchedNeighborhood) {
        neighborhoodId = matchedNeighborhood.id;
        // min_order_value do bairro só bloqueia se for maior que o mínimo
        // global. Se for menor/igual, aceita sem aviso.
        const globalMin = (settings as Settings).min_order_value;
        const effectiveMin = Math.max(globalMin, matchedNeighborhood.min_order_value ?? 0);
        if (subtotal < effectiveMin && matchedNeighborhood.min_order_value > globalMin) {
          return actionError(
            `Pedido mínimo para este bairro é de R$ ${matchedNeighborhood.min_order_value.toFixed(2).replace(".", ",")}.`,
          );
        }
      }

      // Regra principal Mendes v1: frete por distância (Haversine) a partir
      // do CEP de entrega. Teto R$4, fallback R$3. Origem do cálculo = as
      // coordenadas PRÓPRIAS do tenant ativo (settings.store_lat/lng/cep),
      // NÃO mais STORE_LAT/LNG do .env — cada loja usa SUA localização.
      // Se toda a cadeia (ViaCEP/Nominatim/settings vazia) falhar, cai pra
      // tabela por bairro (se casou) ou R$0.
      const cep = normalizeCep(data.address?.zip ?? "");
      let distanceComputed = false;
      if (cep.length === 8) {
        try {
          const store = await readStoreLocationForTenant(db, tenantId);
          if (store) {
            const quote = await quoteDelivery({ cep, store });
            if (quote.ok) {
              deliveryFee = quote.delivery_fee;
              deliverySource = "distance";
              deliveryDistanceKm = quote.distance_km;
              distanceComputed = true;
            } else if (quote.source === "fallback" && quote.delivery_fee > 0) {
              deliveryFee = quote.delivery_fee;
              deliverySource = "neighborhood";
              logError(
                "checkout.delivery_distance_fallback",
                new Error(`reason=${quote.reason ?? "unknown"}`),
              );
            }
          } else {
            // Tenant sem lat/lng/cep nas settings. Admin precisa preencher
            // via /admin/configuracoes — enquanto isso, cai pra tabela
            // por bairro ou R$0.
            logError(
              "checkout.delivery_store_unconfigured",
              new Error(`tenant_id=${tenantId}`),
            );
          }
        } catch (err) {
          logError("checkout.delivery_distance_error", err);
        }
      }

      if (!distanceComputed) {
        deliveryFee = resolveDeliveryFee(matchedNeighborhood, settings as Settings, subtotal);
        deliverySource = "neighborhood";
      }
    }

    let discount = 0;
    if (data.couponCode) {
      const { data: promo } = await db
        .from("promotions")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("coupon_code", data.couponCode)
        .eq("is_active", true)
        .single();

      if (promo) {
        if (promo.type === "free_delivery" && data.fulfillment === "delivery") {
          deliveryFee = 0;
        } else {
          discount = resolveDiscount(promo, subtotal);
        }
      }
    }

    const total = cartTotal({ subtotal, deliveryFee, discount });

    const { data: customer } = await db
      .from("customers")
      .upsert(
        { tenant_id: tenantId, name: data.customerName, phone: data.customerPhone },
        { onConflict: "tenant_id,phone" },
      )
      .select()
      .single();

    const { data: orderNumber } = await db.rpc("next_order_number", { p_tenant: tenantId });
    if (!orderNumber) return actionError("Não foi possível gerar o número do pedido.");

    const { data: order, error: orderError } = await db
      .from("orders")
      .insert({
        tenant_id: tenantId,
        order_number: orderNumber,
        customer_id: customer?.id ?? null,
        customer_name: data.customerName,
        customer_phone: data.customerPhone,
        customer_email: data.customerEmail,
        fulfillment: data.fulfillment,
        mesa: data.fulfillment === "mesa" ? (data.mesa ?? null) : null,
        address_zip: data.address?.zip ?? null,
        address_street: data.address?.street ?? null,
        address_number: data.address?.number ?? null,
        address_complement: data.address?.complement ?? null,
        address_district: data.address?.district ?? null,
        address_reference: data.address?.reference ?? null,
        neighborhood_id: neighborhoodId,
        neighborhood_name: neighborhoodName,
        payment_method: data.paymentMethod,
payment_status: "pending",
change_for: data.paymentMethod === "cash" ? (data.changeFor ?? null) : null,
        items_total: subtotal,
        delivery_fee: deliveryFee,
        discount,
        total,
        coupon_code: data.couponCode || null,
        notes: data.notes || null,
      })
      .select()
      .single();

    if (orderError || !order) {
  logError("checkout.insert_order", orderError);
  return actionError("Não foi possível registrar o pedido. Tente novamente.");
}

    const itemRows = pricedItems.map((item) => {
      const perUnitOptions = item.options.reduce((s, o) => s + o.priceDelta, 0);
      return {
        order_id: order.id,
        product_id: item.productId,
        product_name: item.productName,
        unit_price: item.unitPrice,
        quantity: item.quantity,
        options: item.options,
        options_total: Math.round(perUnitOptions * item.quantity * 100) / 100,
        notes: item.notes || null,
        line_total: Math.round((item.unitPrice + perUnitOptions) * item.quantity * 100) / 100,
      };
    });

    const { error: itemsError } = await db.from("order_items").insert(itemRows);
    if (itemsError) logError("checkout.insert_items", itemsError);

    // Pix Manual (BR Code / EMVCo) — gera o payload local se a loja tiver chave
    // Pix configurada + Pix Manual habilitado. Sem isso, cai no MP dinâmico via
    // /api/pagamentos/pix e o webhook MP confirma depois. Migration
    // 2026-09-18_pix_manual_brcode.sql.
    let pixProvider: "mercadopago" | "manual" | null = null;
    if (data.paymentMethod === "pix") {
      const settingsRow = settings as unknown as Settings;
      if (settingsRow.pix_manual_enabled && settingsRow.pix_key && settingsRow.pix_merchant_city) {
        try {
          const merchantName = settingsRow.pix_beneficiary || settingsRow.business_name;
          const brcode = buildPixBRCode({
            pixKey: settingsRow.pix_key,
            merchantName,
            merchantCity: settingsRow.pix_merchant_city,
            amount: total,
            txid: order.order_number.replace(/[^A-Za-z0-9]/g, "").slice(0, 25) || "***",
          });
          const qrBase64 = await pixBRCodeToBase64(brcode);
          const { error: pixUpdateErr } = await db
            .from("orders")
            .update({
              payment_provider: "manual",
              pix_qr_code: brcode,
              pix_qr_code_base64: qrBase64,
            })
            .eq("id", order.id);
          if (pixUpdateErr) {
            logError("checkout.pix_manual_update", pixUpdateErr);
          } else {
            pixProvider = "manual";
            console.log("[pix] BR Code gerado", {
              orderId: order.id,
              tenantId,
              txid: order.order_number,
              amount: total,
              brcodeLen: brcode.length,
              qrBase64Len: qrBase64.length,
            });
          }
        } catch (pixErr) {
          // Falha ao gerar BR Code — cai pro fluxo MP. Não bloqueia o checkout.
          logError("checkout.pix_manual_generate", pixErr);
        }
      } else {
        // Pix Manual desligado OU sem chave configurada — fluxo MP dinâmico.
        pixProvider = "mercadopago";
      }
    }

    if (customer) {
      await db
        .from("customers")
        .update({
          orders_count: (customer.orders_count ?? 0) + 1,
          total_spent: Math.round(((customer.total_spent ?? 0) + total) * 100) / 100,
          last_order_at: new Date().toISOString(),
        })
        .eq("id", customer.id);
    }

    // Disparo fire-and-forget pro webhook do n8n em pedidos cash/card.
    // Pix tem seu próprio disparo dentro do /api/webhooks/mercadopago após approved.
    // Mesa: AGORA dispara na criação também — dono precisa receber a comanda
    //       pra começar a preparar. A supressão que vale pro MESA é só o link
    //       wa.me de confirmação pro cliente (whatsappUrl = ""), porque ele já
    //       tá sentado na mesa. A notificação "saiu pra entrega" segue sendo
    //       enviada quando o admin mover pra coluna correspondente.
    // Pix Manual: AGORA também dispara na criação — o lojista precisa receber
    //             o pedido pra cruzar com o comprovante que o cliente manda
    //             no WhatsApp. Lote 1 item 4 (migration 2026-09-18).
    // Não bloqueia o actionOk — erro do n8n é tratado dentro do helper.
    const isPixManual = data.paymentMethod === "pix" && pixProvider === "manual";
    if (data.paymentMethod !== "pix" || isPixManual) {
      const tenantRow = tenant as unknown as { id: string; slug: string; evolution_instance_name: string | null };
      const settingsRow = settings as unknown as Settings;
      void sendOrderToN8N(
        buildOrderPayload(
          order as unknown as Parameters<typeof buildOrderPayload>[0],
          itemRows.map((ir, idx) => ({
            id: `tmp-${idx}`,
            order_id: order.id,
            product_id: ir.product_id,
            product_name: ir.product_name,
            unit_price: ir.unit_price,
            quantity: ir.quantity,
            options: ir.options as { groupName: string; optionName: string; priceDelta: number }[],
            options_total: ir.options_total,
            notes: ir.notes,
            line_total: ir.line_total,
            created_at: new Date().toISOString(),
          })) as unknown as Parameters<typeof buildOrderPayload>[1],
          {
            tenant_id: tenantRow.id,
            tenant_slug: tenantRow.slug,
            evolution_instance_name: tenantRow.evolution_instance_name ?? null,
            store_whatsapp: settingsRow.whatsapp_number ?? null,
          },
        ),
      );
    }

    const message = buildWhatsAppMessage({
      businessName: (settings as Settings).business_name,
      orderNumber: order.order_number,
      customerName: data.customerName,
      customerPhone: data.customerPhone,
      fulfillment: data.fulfillment,
      address: data.address
        ? {
            street: data.address.street,
            number: data.address.number,
            complement: data.address.complement,
            district: data.address.district,
            reference: data.address.reference,
          }
        : null,
      items: pricedItems,
      paymentMethod: data.paymentMethod,
      changeFor: data.changeFor,
      subtotal,
      deliveryFee,
      discount,
      total,
      notes: data.notes,
    });

    // Mesa: cliente já tá sentado — não enviamos link wa.me pra confirmar
    // pedido (ele escaneou o QR da mesa e tá ali). Notificação sai quando o
    // admin mover pra "Saiu p/ Entrega". whatsappUrl fica vazio.
    const whatsappUrl =
      data.fulfillment === "mesa"
        ? ""
        : buildWhatsAppUrl((settings as Settings).whatsapp_number, message);

    return actionOk({
  orderId: order.id,
  orderNumber: order.order_number,
  publicToken: order.public_token,
  customerEmail: data.customerEmail,
  whatsappUrl,
});
  } catch (err) {
    logError("checkout.submit", err);
    return actionError(toUserMessage(err));
  }
}
