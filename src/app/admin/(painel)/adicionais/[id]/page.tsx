import { notFound } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { OptionGroupForm } from "@/components/admin/option-group-form";
import { OptionsManager } from "@/components/admin/options-manager";
import type { OptionGroup, ProductOption } from "@/types/database";

export default async function EditarGrupoAdicionalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabase();

  const [{ data: group }, { data: options }] = await Promise.all([
    supabase.from("option_groups").select("*").eq("id", id).single(),
    supabase.from("options").select("*").eq("group_id", id).order("sort_order", { ascending: true }),
  ]);
  if (!group) notFound();

  return (
    <div className="max-w-lg space-y-8">
      <div className="space-y-4">
        <h1 className="text-xl font-bold text-stone-900">Editar grupo de adicionais</h1>
        <OptionGroupForm group={group as OptionGroup} />
      </div>

      <div className="space-y-3 border-t border-stone-200 pt-6">
        <h2 className="font-semibold text-stone-900">Opções deste grupo</h2>
        <OptionsManager groupId={id} options={(options ?? []) as ProductOption[]} />
      </div>
    </div>
  );
}
