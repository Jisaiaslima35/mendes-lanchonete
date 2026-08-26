import Link from "next/link";
import { Plus, Pencil } from "lucide-react";
import { createServerSupabase } from "@/lib/supabase/server";
import { getCurrentTenantId } from "@/lib/tenant";
import { deleteProduct } from "@/lib/actions/admin-products";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/admin/data-table";
import { ConfirmDeleteButton } from "@/components/admin/confirm-delete-button";
import type { Category, Product } from "@/types/database";

export default async function AdminProdutosPage() {
  const supabase = await createServerSupabase();
  const tenantId = await getCurrentTenantId();

  const { data } = await supabase
    .from("products")
    .select("*, category:categories(id, name)")
    .eq("tenant_id", tenantId)
    .order("sort_order", { ascending: true });

  const products = (data ?? []) as (Product & { category: Pick<Category, "id" | "name"> | null })[];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-stone-900">Produtos</h1>
        <Link href="/admin/produtos/novo">
          <Button size="sm">
            <Plus className="h-4 w-4" aria-hidden />
            Novo produto
          </Button>
        </Link>
      </div>

      <DataTable
        rows={products}
        getRowKey={(p) => p.id}
        emptyMessage="Nenhum produto cadastrado ainda."
        columns={[
          { header: "Nome", cell: (p) => <span className="font-medium text-stone-900">{p.name}</span> },
          { header: "Categoria", cell: (p) => p.category?.name ?? "—" },
          {
            header: "Preço",
            cell: (p) =>
              p.promo_price != null ? (
                <span>
                  <span className="text-stone-400 line-through">{formatCurrency(p.price)}</span>{" "}
                  {formatCurrency(p.promo_price)}
                </span>
              ) : (
                formatCurrency(p.price)
              ),
          },
          {
            header: "Status",
            cell: (p) => (
              <div className="flex gap-1">
                <Badge tone={p.is_active ? "success" : "neutral"}>{p.is_active ? "Visível" : "Oculto"}</Badge>
                {!p.is_available && <Badge tone="danger">Esgotado</Badge>}
              </div>
            ),
          },
          {
            header: "",
            className: "text-right",
            cell: (p) => (
              <div className="flex justify-end gap-1">
                <Link
                  href={`/admin/produtos/${p.id}`}
                  aria-label={`Editar ${p.name}`}
                  className="rounded p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-700"
                >
                  <Pencil className="h-4 w-4" />
                </Link>
                <ConfirmDeleteButton
                  action={deleteProduct.bind(null, p.id)}
                  confirmMessage={`Excluir o produto "${p.name}"?`}
                />
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}
