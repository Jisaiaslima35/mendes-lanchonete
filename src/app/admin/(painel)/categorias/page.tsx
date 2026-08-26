import Link from "next/link";
import { Plus, Pencil } from "lucide-react";
import { createServerSupabase } from "@/lib/supabase/server";
import { getCurrentTenantId } from "@/lib/tenant";
import { deleteCategory } from "@/lib/actions/admin-categories";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/admin/data-table";
import { ConfirmDeleteButton } from "@/components/admin/confirm-delete-button";
import type { Category } from "@/types/database";

export default async function AdminCategoriasPage() {
  const supabase = await createServerSupabase();
  const tenantId = await getCurrentTenantId();

  const { data } = await supabase
    .from("categories")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("sort_order", { ascending: true });

  const categories = (data ?? []) as Category[];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-stone-900">Categorias</h1>
        <Link href="/admin/categorias/nova">
          <Button size="sm">
            <Plus className="h-4 w-4" aria-hidden />
            Nova categoria
          </Button>
        </Link>
      </div>

      <DataTable
        rows={categories}
        getRowKey={(c) => c.id}
        emptyMessage="Nenhuma categoria cadastrada ainda."
        columns={[
          { header: "Nome", cell: (c) => <span className="font-medium text-stone-900">{c.name}</span> },
          { header: "Slug", cell: (c) => <span className="text-stone-500">{c.slug}</span> },
          { header: "Ordem", cell: (c) => c.sort_order },
          {
            header: "Status",
            cell: (c) => (
              <Badge tone={c.is_active ? "success" : "neutral"}>{c.is_active ? "Ativa" : "Oculta"}</Badge>
            ),
          },
          {
            header: "",
            className: "text-right",
            cell: (c) => (
              <div className="flex justify-end gap-1">
                <Link
                  href={`/admin/categorias/${c.id}`}
                  aria-label={`Editar ${c.name}`}
                  className="rounded p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-700"
                >
                  <Pencil className="h-4 w-4" />
                </Link>
                <ConfirmDeleteButton
                  action={deleteCategory.bind(null, c.id)}
                  confirmMessage={`Excluir a categoria "${c.name}"? Isso falhará se houver produtos vinculados a ela.`}
                />
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}
