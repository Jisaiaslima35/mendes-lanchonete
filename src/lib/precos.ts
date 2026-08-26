import { round2 } from "@/lib/utils";
import type { Neighborhood, Product, Promotion, Settings } from "@/types/database";

export type PricedOption = {
  id: string;
  groupName: string;
  optionName: string;
  priceDelta: number;
};

export type PricedCartItem = {
  productId: string;
  productName: string;
  /** Preço efetivo do produto (promo_price se houver, senão price). */
  unitPrice: number;
  quantity: number;
  options: PricedOption[];
  notes?: string;
};

/** Preço efetivo de um produto: promo_price quando existir, senão price. */
export function effectivePrice(product: Pick<Product, "price" | "promo_price">) {
  return product.promo_price ?? product.price;
}

export function optionsTotalPerUnit(options: PricedOption[]) {
  return round2(options.reduce((sum, o) => sum + o.priceDelta, 0));
}

/** Total da linha: (preço unitário + adicionais) x quantidade. */
export function lineTotal(item: PricedCartItem) {
  const perUnit = round2(item.unitPrice + optionsTotalPerUnit(item.options));
  return round2(perUnit * item.quantity);
}

export function itemsSubtotal(items: PricedCartItem[]) {
  return round2(items.reduce((sum, item) => sum + lineTotal(item), 0));
}

/**
 * Taxa de entrega considerando o bairro escolhido e o limiar de frete grátis.
 * Prioridade: limiar do bairro > limiar global das configurações.
 */
export function resolveDeliveryFee(
  neighborhood: Pick<Neighborhood, "delivery_fee" | "free_delivery_threshold"> | null,
  settings: Pick<Settings, "free_delivery_threshold">,
  subtotal: number,
) {
  if (!neighborhood) return 0;

  const threshold = neighborhood.free_delivery_threshold ?? settings.free_delivery_threshold;
  if (threshold != null && subtotal >= threshold) return 0;
  return neighborhood.delivery_fee;
}

/** Desconto aplicado por um cupom de promoção, respeitando o pedido mínimo do cupom. */
export function resolveDiscount(
  promotion: Pick<Promotion, "type" | "value" | "min_order_value"> | null,
  subtotal: number,
) {
  if (!promotion || promotion.type === "banner") return 0;
  if (subtotal < promotion.min_order_value) return 0;

  if (promotion.type === "percent") {
    return round2(subtotal * (promotion.value / 100));
  }
  if (promotion.type === "fixed") {
    return round2(Math.min(promotion.value, subtotal));
  }
  // free_delivery é tratado separadamente na taxa de entrega, sem desconto direto aqui.
  return 0;
}

export function cartTotal(params: { subtotal: number; deliveryFee: number; discount: number }) {
  const total = params.subtotal + params.deliveryFee - params.discount;
  return round2(Math.max(0, total));
}
