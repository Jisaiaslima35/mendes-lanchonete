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
import { buildWhatsAppMessage, buildWhatsAppUrl } from "@/lib/whatsapp";
import { actionError, actionOk, logError, toUserMessage, type ActionResult } from "@/lib/errors";
import type { BusinessHour, Settings } from "@/types/database";

type CheckoutResult = { orderNumber: string; publicToken: string; whatsappUrl: string };

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

    const [{ data: settings }, { data: hours }] = await Promise.all([
      db.from("settings").select("*").eq("tenant_id", tenantId).single(),
      db.from("business_hours").select("*").eq("tenant_id", tenantId),
    ]);
    if (!settings) return actionError("Loja não configurada.");

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
    let neighborhoodName: string | null = null;
    let neighborhoodId: string | null = null;

    if (data.fulfillment === "delivery") {
      const { data: neighborhood } = await db
        .from("neighborhoods")
        .select("*")
        .eq("id", data.address!.neighborhoodId)
        .eq("tenant_id", tenantId)
        .eq("is_active", true)
        .single();

      if (!neighborhood) return actionError("Bairro não atendido.");
      if (subtotal < neighborhood.min_order_value) {
        return actionError(
          `Pedido mínimo para este bairro é de R$ ${neighborhood.min_order_value.toFixed(2).replace(".", ",")}.`,
        );
      }
      deliveryFee = resolveDeliveryFee(neighborhood, settings as Settings, subtotal);
      neighborhoodName = neighborhood.name;
      neighborhoodId = neighborhood.id;
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
        fulfillment: data.fulfillment,
        address_zip: data.address?.zip ?? null,
        address_street: data.address?.street ?? null,
        address_number: data.address?.number ?? null,
        address_complement: data.address?.complement ?? null,
        address_district: data.address?.district ?? null,
        address_reference: data.address?.reference ?? null,
        neighborhood_id: neighborhoodId,
        neighborhood_name: neighborhoodName,
        payment_method: data.paymentMethod,
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

    const whatsappUrl = buildWhatsAppUrl((settings as Settings).whatsapp_number, message);

    return actionOk({ orderNumber: order.order_number, publicToken: order.public_token, whatsappUrl });
  } catch (err) {
    logError("checkout.submit", err);
    return actionError(toUserMessage(err));
  }
}
