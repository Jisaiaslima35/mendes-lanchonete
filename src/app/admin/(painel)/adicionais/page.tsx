import Link from "next/link";
import { Plus, Pencil } from "lucide-react";
import { createServerSupabase } from "@/lib/supabase/server";
import { getCurrentTenantId } from "@/lib/tenant";
import { deleteOptionGroup } from "@/lib/actions/admin-options";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/admin/data-table";
import { ConfirmDeleteButton } from "@/components/admin/confirm-delete-button";
import type { OptionGroup } from "@/types/database";

export default async function AdminAdicionaisPage() {
  const supabase = await createServerSupabase();
  const tenantId = await getCurrentTenantId();

  const { data } = await supabase
    .from("option_groups")
    .select("*, options(id)")
    .eq("tenant_id", tenantId)
    .order("sort_order", { ascending: true });

  const groups = (data ?? []) as (OptionGroup & { options: { id: string }[] })[];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-stone-900">Adicionais</h1>
        <Link href="/admin/adicionais/novo">
          <Button size="sm">
            <Plus className="h-4 w-4" aria-hidden />
            Novo grupo
          </Button>
        </Link>
      </div>

      <DataTable
        rows={groups}
        getRowKey={(g) => g.id}
        emptyMessage="Nenhum grupo de adicionais cadastrado ainda."
        columns={[
          { header: "Nome", cell: (g) => <span className="font-medium text-stone-900">{g.name}</span> },
          {
            header: "Tipo",
            cell: (g) => (g.selection_type === "single" ? "Única escolha" : "Múltipla escolha"),
          },
          { header: "Opções", cell: (g) => g.options?.length ?? 0 },
          {
            header: "Status",
            cell: (g) => <Badge tone={g.is_active ? "success" : "neutral"}>{g.is_active ? "Ativo" : "Inativo"}</Badge>,
          },
          {
            header: "",
            className: "text-right",
            cell: (g) => (
              <div className="flex justify-end gap-1">
                <Link
                  href={`/admin/adicionais/${g.id}`}
                  aria-label={`Editar ${g.name}`}
                  className="rounded p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-700"
                >
                  <Pencil className="h-4 w-4" />
                </Link>
                <ConfirmDeleteButton
                  action={deleteOptionGroup.bind(null, g.id)}
                  confirmMessage={`Excluir o grupo "${g.name}" e todas as suas opções? Ele será desvinculado dos produtos que o usam.`}
                />
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}
