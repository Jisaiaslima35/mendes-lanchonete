import { createServerSupabase } from "@/lib/supabase/server";
import { getCurrentTenantId } from "@/lib/tenant";
import { formatCurrency } from "@/lib/utils";
import { ORDER_STATUS_LABELS } from "@/lib/pedido-status";

type Metrics = {
  orders_count: number;
  revenue: number;
  avg_ticket: number;
  by_status: { status: string; count: number }[];
  top_products: { name: string; quantity: number }[];
};

export default async function AdminDashboardPage() {
  const supabase = await createServerSupabase();
  const tenantId = await getCurrentTenantId();

  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);

  const { data } = await supabase.rpc("dashboard_metrics", {
    p_tenant: tenantId,
    p_from: start.toISOString(),
    p_to: end.toISOString(),
  });

  const metrics = (data ?? {
    orders_count: 0,
    revenue: 0,
    avg_ticket: 0,
    by_status: [],
    top_products: [],
  }) as Metrics;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-stone-900">Dashboard — hoje</h1>

      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-stone-200 bg-white p-4">
          <p className="text-sm text-stone-500">Pedidos hoje</p>
          <p className="text-2xl font-bold text-stone-900">{metrics.orders_count}</p>
        </div>
        <div className="rounded-xl border border-stone-200 bg-white p-4">
          <p className="text-sm text-stone-500">Faturamento</p>
          <p className="text-2xl font-bold text-stone-900">{formatCurrency(metrics.revenue)}</p>
        </div>
        <div className="rounded-xl border border-stone-200 bg-white p-4">
          <p className="text-sm text-stone-500">Ticket médio</p>
          <p className="text-2xl font-bold text-stone-900">{formatCurrency(metrics.avg_ticket)}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-xl border border-stone-200 bg-white p-4">
          <p className="mb-2 font-semibold text-stone-900">Pedidos por status</p>
          {metrics.by_status.length === 0 ? (
            <p className="text-sm text-stone-500">Sem pedidos hoje.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {metrics.by_status.map((s) => (
                <li key={s.status} className="flex justify-between">
                  <span>{ORDER_STATUS_LABELS[s.status as keyof typeof ORDER_STATUS_LABELS] ?? s.status}</span>
                  <span className="font-medium">{s.count}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-xl border border-stone-200 bg-white p-4">
          <p className="mb-2 font-semibold text-stone-900">Mais vendidos hoje</p>
          {metrics.top_products.length === 0 ? (
            <p className="text-sm text-stone-500">Sem vendas hoje.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {metrics.top_products.map((p) => (
                <li key={p.name} className="flex justify-between">
                  <span>{p.name}</span>
                  <span className="font-medium">{p.quantity}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
