import { formatCurrency } from "@/lib/utils";
import type { Promotion } from "@/types/database";

/** Etiqueta curta de desconto (ex.: "10% OFF", "R$ 5,00 OFF", "Frete grátis") a partir de dados reais da promoção. */
export function promotionTagLabel(promotion: Pick<Promotion, "type" | "value">): string | null {
  switch (promotion.type) {
    case "percent":
      return `${promotion.value}% OFF`;
    case "fixed":
      return `${formatCurrency(promotion.value)} OFF`;
    case "free_delivery":
      return "Frete grátis";
    default:
      return null;
  }
}
