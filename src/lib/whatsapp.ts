import { formatCurrency, toWhatsAppNumber } from "@/lib/utils";
import { lineTotal, type PricedCartItem } from "@/lib/precos";
import type { FulfillmentType, PaymentMethod } from "@/types/database";

export type WhatsAppOrderSummary = {
  businessName: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  fulfillment: FulfillmentType;
  address?: {
    street: string;
    number: string;
    complement?: string | null;
    district: string;
    reference?: string | null;
  } | null;
  items: PricedCartItem[];
  paymentMethod: PaymentMethod;
  changeFor?: number | null;
  subtotal: number;
  deliveryFee: number;
  discount: number;
  total: number;
  notes?: string | null;
};

const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  pix: "Pix",
  cash: "Dinheiro",
  card: "Cartão na entrega",
};

function padLine(label: string, value: string, width = 24) {
  const dots = ".".repeat(Math.max(1, width - label.length));
  return `${label} ${dots} ${value}`;
}

export function buildWhatsAppMessage(order: WhatsAppOrderSummary): string {
  const lines: string[] = [];

  lines.push(`*PEDIDO ${order.orderNumber}* — ${order.businessName}`);
  lines.push("");
  lines.push("*Cliente*");
  lines.push(`${order.customerName} — ${order.customerPhone}`);
  lines.push("");

  if (order.fulfillment === "delivery" && order.address) {
    lines.push("*Entrega*");
    const complement = order.address.complement ? ` — ${order.address.complement}` : "";
    lines.push(`${order.address.street}, ${order.address.number}${complement}`);
    lines.push(order.address.district);
    if (order.address.reference) lines.push(`Ref: ${order.address.reference}`);
  } else {
    lines.push("*Retirada no local*");
  }
  lines.push("");

  lines.push("*Itens*");
  for (const item of order.items) {
    lines.push(
      `${item.quantity}x ${padLine(item.productName, formatCurrency(lineTotal(item)))}`,
    );
    for (const opt of item.options) {
      lines.push(`   + ${opt.optionName} (${formatCurrency(opt.priceDelta)})`);
    }
    if (item.notes) lines.push(`   Obs: ${item.notes}`);
  }
  lines.push("");

  lines.push("*Pagamento*");
  const paymentLine = PAYMENT_LABELS[order.paymentMethod];
  if (order.paymentMethod === "cash" && order.changeFor != null) {
    lines.push(`${paymentLine} — troco para ${formatCurrency(order.changeFor)}`);
  } else {
    lines.push(paymentLine);
  }
  lines.push("");

  lines.push(padLine("Subtotal", formatCurrency(order.subtotal)));
  if (order.deliveryFee > 0) {
    lines.push(padLine("Entrega", formatCurrency(order.deliveryFee)));
  }
  if (order.discount > 0) {
    lines.push(padLine("Desconto", `-${formatCurrency(order.discount)}`));
  }
  lines.push(`*${padLine("Total", formatCurrency(order.total))}*`);

  if (order.notes) {
    lines.push("");
    lines.push(`*Observações do pedido*`);
    lines.push(order.notes);
  }

  return lines.join("\n");
}

export function buildWhatsAppUrl(phoneNumber: string, message: string) {
  const number = toWhatsAppNumber(phoneNumber);
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}
