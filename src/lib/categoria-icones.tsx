import { Sandwich, Pizza, UtensilsCrossed, CupSoda, Package, Croissant, type LucideIcon } from "lucide-react";

/** Ícone ilustrativo por slug de categoria — puramente visual, não depende de dado novo no banco. */
export const ICONES_POR_CATEGORIA: Record<string, LucideIcon> = {
  lanches: Sandwich,
  pasteis: Pizza,
  porcoes: UtensilsCrossed,
  bebidas: CupSoda,
  combos: Package,
  padaria: Croissant,
};

export const ICONE_CATEGORIA_PADRAO: LucideIcon = UtensilsCrossed;
