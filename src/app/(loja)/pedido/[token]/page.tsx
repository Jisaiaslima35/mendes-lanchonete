import { notFound } from "next/navigation";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { getOrderByPublicToken } from "@/lib/queries/pedido";
import { getSettings } from "@/lib/queries/catalogo";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { BotaoWhatsApp } from "@/components/site/botao-whatsapp";
import { ORDER_STATUS_LABELS, ORDER_STATUS_TONE } from "@/lib/pedido-status";

export default async function PedidoConfirmacaoPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const [order, settings] = await Promise.all([getOrderByPublicToken(token), getSettings()]);
  if (!order) notFound();

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center gap-2 py-4 text-center">
        <CheckCircle2 className="h-12 w-12 text-green-600" aria-hidden />
        <h1 className="text-xl font-bold text-brand-900">Pedido enviado!</h1>
        <p className="text-stone-600">
          Pedido <strong>{order.order_number}</strong> recebido às {formatDateTime(order.created_at)}.
        </p>
        <Badge tone={ORDER_STATUS_TONE[order.status]}>{ORDER_STATUS_LABELS[order.status]}</Badge>
      </div>

      <div className="rounded-xl border border-stone-200 bg-white p-4">
        <p className="mb-2 font-semibold text-brand-900">Itens</p>
        <ul className="space-y-2">
          {order.order_items.map((item) => (
            <li key={item.id} className="flex justify-between text-sm">
              <span>
                {item.quantity}x {item.product_name}
              </span>
              <span>{formatCurrency(item.line_total)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-3 space-y-1 border-t border-stone-100 pt-2 text-sm text-stone-600">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span>{formatCurrency(order.items_total)}</span>
          </div>
          {order.delivery_fee > 0 && (
            <div className="flex justify-between">
              <span>Entrega</span>
              <span>{formatCurrency(order.delivery_fee)}</span>
            </div>
          )}
          {order.discount > 0 && (
            <div className="flex justify-between">
              <span>Desconto</span>
              <span>-{formatCurrency(order.discount)}</span>
            </div>
          )}
          <div className="flex justify-between pt-1 font-bold text-brand-900">
            <span>Total</span>
            <span>{formatCurrency(order.total)}</span>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-stone-200 bg-white p-4 text-sm text-stone-600">
        <p className="mb-1 font-semibold text-brand-900">
          {order.fulfillment === "delivery" ? "Entrega" : "Retirada no local"}
        </p>
        {order.fulfillment === "delivery" && (
          <p>
            {order.address_street}, {order.address_number}
            {order.address_complement ? ` — ${order.address_complement}` : ""} —{" "}
            {order.neighborhood_name}
          </p>
        )}
      </div>

      <p className="text-center text-sm text-stone-500">
        Se o WhatsApp não abriu automaticamente, toque no botão abaixo para confirmar seu pedido.
      </p>
      <div className="flex justify-center">
        <BotaoWhatsApp numero={settings.whatsapp_number} mensagem={`Olá! Confirmando meu pedido ${order.order_number}.`} />
      </div>

      <Link href="/cardapio" className="block text-center text-sm font-medium text-brand-600">
        Voltar ao cardápio
      </Link>
    </div>
  );
}
