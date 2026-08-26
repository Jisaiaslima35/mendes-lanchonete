import { createServerSupabase } from "@/lib/supabase/server";
import { getCurrentTenantId } from "@/lib/tenant";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { StatusSelect } from "@/components/admin/status-select";
import type { Order, OrderItem } from "@/types/database";

export default async function AdminPedidosPage() {
  const supabase = await createServerSupabase();
  const tenantId = await getCurrentTenantId();

  const { data } = await supabase
    .from("orders")
    .select("*, order_items(*)")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(100);

  const orders = (data ?? []) as unknown as (Order & { order_items: OrderItem[] })[];

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-stone-900">Pedidos</h1>

      {orders.length === 0 ? (
        <p className="text-stone-500">Nenhum pedido ainda.</p>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => (
            <div key={order.id} className="rounded-xl border border-stone-200 bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-bold text-stone-900">{order.order_number}</p>
                  <p className="text-sm text-stone-500">
                    {formatDateTime(order.created_at)} — {order.customer_name} ({order.customer_phone})
                  </p>
                </div>
                <StatusSelect orderId={order.id} status={order.status} />
              </div>

              <ul className="mt-3 space-y-1 border-t border-stone-100 pt-2 text-sm text-stone-700">
                {order.order_items.map((item) => (
                  <li key={item.id} className="flex justify-between">
                    <span>
                      {item.quantity}x {item.product_name}
                    </span>
                    <span>{formatCurrency(item.line_total)}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-stone-100 pt-2 text-sm">
                <span className="text-stone-500">
                  {order.fulfillment === "delivery"
                    ? `Entrega — ${order.neighborhood_name ?? ""}`
                    : "Retirada no local"}{" "}
                  · {order.payment_method === "pix" ? "Pix" : order.payment_method === "cash" ? "Dinheiro" : "Cartão"}
                </span>
                <span className="font-bold text-stone-900">{formatCurrency(order.total)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
