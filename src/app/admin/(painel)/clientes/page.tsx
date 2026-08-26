import { createServerSupabase } from "@/lib/supabase/server";
import { getCurrentTenantId } from "@/lib/tenant";
import { formatCurrency, formatDateTime, formatPhone } from "@/lib/utils";
import { DataTable } from "@/components/admin/data-table";
import { Input } from "@/components/ui/field";
import type { Customer } from "@/types/database";

export default async function AdminClientesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const supabase = await createServerSupabase();
  const tenantId = await getCurrentTenantId();

  let query = supabase
    .from("customers")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("last_order_at", { ascending: false, nullsFirst: false });

  if (q) query = query.or(`name.ilike.%${q}%,phone.ilike.%${q}%`);

  const { data } = await query;
  const customers = (data ?? []) as Customer[];

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-stone-900">Clientes</h1>

      <form className="max-w-sm">
        <Input type="search" name="q" placeholder="Buscar por nome ou telefone" defaultValue={q ?? ""} />
      </form>

      <DataTable
        rows={customers}
        getRowKey={(c) => c.id}
        emptyMessage="Nenhum cliente encontrado."
        columns={[
          { header: "Nome", cell: (c) => <span className="font-medium text-stone-900">{c.name}</span> },
          { header: "Telefone", cell: (c) => formatPhone(c.phone) },
          { header: "Pedidos", cell: (c) => c.orders_count },
          { header: "Total gasto", cell: (c) => formatCurrency(c.total_spent) },
          {
            header: "Último pedido",
            cell: (c) => (c.last_order_at ? formatDateTime(c.last_order_at) : "—"),
          },
        ]}
      />
    </div>
  );
}
