import Link from "next/link";
import { Plus, Pencil } from "lucide-react";
import { createServerSupabase } from "@/lib/supabase/server";
import { getCurrentTenantId } from "@/lib/tenant";
import { deletePromotion } from "@/lib/actions/admin-promotions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/admin/data-table";
import { ConfirmDeleteButton } from "@/components/admin/confirm-delete-button";
import type { Promotion } from "@/types/database";

const TYPE_LABELS: Record<string, string> = {
  percent: "% desconto",
  fixed: "Valor fixo",
  free_delivery: "Frete grátis",
  banner: "Banner",
};

export default async function AdminPromocoesPage() {
  const supabase = await createServerSupabase();
  const tenantId = await getCurrentTenantId();

  const { data } = await supabase
    .from("promotions")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("sort_order", { ascending: true });

  const promotions = (data ?? []) as Promotion[];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-stone-900">Promoções</h1>
        <Link href="/admin/promocoes/nova">
          <Button size="sm">
            <Plus className="h-4 w-4" aria-hidden />
            Nova promoção
          </Button>
        </Link>
      </div>

      <DataTable
        rows={promotions}
        getRowKey={(p) => p.id}
        emptyMessage="Nenhuma promoção cadastrada ainda."
        columns={[
          { header: "Título", cell: (p) => <span className="font-medium text-stone-900">{p.title}</span> },
          { header: "Tipo", cell: (p) => TYPE_LABELS[p.type] ?? p.type },
          { header: "Cupom", cell: (p) => p.coupon_code ?? "—" },
          {
            header: "Status",
            cell: (p) => <Badge tone={p.is_active ? "success" : "neutral"}>{p.is_active ? "Ativa" : "Inativa"}</Badge>,
          },
          {
            header: "",
            className: "text-right",
            cell: (p) => (
              <div className="flex justify-end gap-1">
                <Link
                  href={`/admin/promocoes/${p.id}`}
                  aria-label={`Editar ${p.title}`}
                  className="rounded p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-700"
                >
                  <Pencil className="h-4 w-4" />
                </Link>
                <ConfirmDeleteButton
                  action={deletePromotion.bind(null, p.id)}
                  confirmMessage={`Excluir a promoção "${p.title}"?`}
                />
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}
