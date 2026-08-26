import type { OrderStatus } from "@/types/database";

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  novo: "Novo",
  confirmado: "Confirmado",
  em_preparo: "Em preparo",
  pronto: "Pronto",
  saiu_entrega: "Saiu para entrega",
  entregue: "Entregue",
  cancelado: "Cancelado",
};

export const ORDER_STATUS_TONE: Record<
  OrderStatus,
  "neutral" | "success" | "warning" | "danger" | "brand"
> = {
  novo: "brand",
  confirmado: "warning",
  em_preparo: "warning",
  pronto: "success",
  saiu_entrega: "success",
  entregue: "neutral",
  cancelado: "danger",
};

export const ORDER_STATUS_ORDER: OrderStatus[] = [
  "novo",
  "confirmado",
  "em_preparo",
  "pronto",
  "saiu_entrega",
  "entregue",
  "cancelado",
];
