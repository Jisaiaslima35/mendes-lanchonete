import { createServerSupabase } from "@/lib/supabase/server";
import { getCurrentTenantId } from "@/lib/tenant";
import { KanbanBoard, type KanbanOrder } from "@/components/admin/kanban-board";
import type { Order, OrderItem } from "@/types/database";

type OrderRow = Order & {
  order_items: OrderItem[];
  payment_status: "pending" | "confirmed" | "failed";
};

function summarizeItems(items: OrderItem[]): string {
  return items
    .map((it) => `${it.quantity}x ${it.product_name}`)
    .join(" · ");
}

export default async function AdminPedidosPage() {
  const supabase = await createServerSupabase();
  const tenantId = await getCurrentTenantId();

  // Pega até 150 pedidos abertos + concluídos recentes pra alimentar o Kanban.
  // Concluídos com mais de 24h ficam fora pra não poluir a coluna "Concluídos".
  // eslint-disable-next-line react-hooks/purity
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data } = await supabase
    .from("orders")
    .select("*, order_items(*)")
    .eq("tenant_id", tenantId)
    .or(`status.neq.entregue,created_at.gte.${since}`)
    .order("created_at", { ascending: false })
    .limit(150);

  const rows = (data ?? []) as unknown as OrderRow[];

  const orders: KanbanOrder[] = rows.map((row) => ({
    id: row.id,
    order_number: row.order_number,
    created_at: row.created_at,
    customer_name: row.customer_name,
    neighborhood_name: row.neighborhood_name ?? null,
    fulfillment: row.fulfillment,
    mesa: row.mesa ?? null,
    payment_method: row.payment_method,
    payment_status: row.payment_status,
    payment_provider: (row as unknown as { payment_provider?: "mercadopago" | "manual" | null })
      .payment_provider ?? null,
    change_for: row.change_for ?? null,
    total: row.total,
    status: row.status,
    notes: row.notes ?? null,
    items: (row.order_items ?? []).map((it) => ({
      id: it.id,
      quantity: it.quantity,
      product_name: it.product_name,
      notes: it.notes ?? null,
    })),
    items_summary: summarizeItems(row.order_items),
  }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-stone-900">Pedidos</h1>
        <p className="text-xs text-stone-500">
          Atualização em tempo real · clique em <strong>Avançar</strong> para mover o card
        </p>
      </div>

      {orders.length === 0 ? (
        <p className="rounded-xl border border-dashed border-stone-200 bg-white p-6 text-center text-stone-500">
          Nenhum pedido ativo. Quando chegar um pedido novo, ele aparece aqui automaticamente.
        </p>
      ) : (
        <KanbanBoard initialOrders={orders} />
      )}
    </div>
  );
}
