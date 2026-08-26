import Link from "next/link";
import { Plus, Pencil } from "lucide-react";
import { createServerSupabase } from "@/lib/supabase/server";
import { getCurrentTenantId } from "@/lib/tenant";
import { deleteNeighborhood } from "@/lib/actions/admin-neighborhoods";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/admin/data-table";
import { ConfirmDeleteButton } from "@/components/admin/confirm-delete-button";
import type { Neighborhood } from "@/types/database";

export default async function AdminBairrosPage() {
  const supabase = await createServerSupabase();
  const tenantId = await getCurrentTenantId();

  const { data } = await supabase
    .from("neighborhoods")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("name", { ascending: true });

  const neighborhoods = (data ?? []) as Neighborhood[];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-stone-900">Bairros</h1>
        <Link href="/admin/bairros/novo">
          <Button size="sm">
            <Plus className="h-4 w-4" aria-hidden />
            Novo bairro
          </Button>
        </Link>
      </div>

      <DataTable
        rows={neighborhoods}
        getRowKey={(n) => n.id}
        emptyMessage="Nenhum bairro cadastrado ainda."
        columns={[
          { header: "Nome", cell: (n) => <span className="font-medium text-stone-900">{n.name}</span> },
          { header: "Taxa de entrega", cell: (n) => formatCurrency(n.delivery_fee) },
          { header: "Tempo estimado", cell: (n) => `${n.estimated_minutes} min` },
          {
            header: "Status",
            cell: (n) => (
              <Badge tone={n.is_active ? "success" : "neutral"}>{n.is_active ? "Ativo" : "Inativo"}</Badge>
            ),
          },
          {
            header: "",
            className: "text-right",
            cell: (n) => (
              <div className="flex justify-end gap-1">
                <Link
                  href={`/admin/bairros/${n.id}`}
                  aria-label={`Editar ${n.name}`}
                  className="rounded p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-700"
                >
                  <Pencil className="h-4 w-4" />
                </Link>
                <ConfirmDeleteButton
                  action={deleteNeighborhood.bind(null, n.id)}
                  confirmMessage={`Excluir o bairro "${n.name}"?`}
                />
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}
