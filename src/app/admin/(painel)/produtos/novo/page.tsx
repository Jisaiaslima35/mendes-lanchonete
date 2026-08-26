import { createServerSupabase } from "@/lib/supabase/server";
import { getCurrentTenantId } from "@/lib/tenant";
import { ProductForm } from "@/components/admin/product-form";
import type { Category, OptionGroup } from "@/types/database";

export default async function NovoProdutoPage() {
  const supabase = await createServerSupabase();
  const tenantId = await getCurrentTenantId();

  const [{ data: categories }, { data: optionGroups }] = await Promise.all([
    supabase.from("categories").select("*").eq("tenant_id", tenantId).order("sort_order"),
    supabase.from("option_groups").select("*").eq("tenant_id", tenantId).order("sort_order"),
  ]);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-stone-900">Novo produto</h1>
      {(categories ?? []).length === 0 ? (
        <p className="text-sm text-red-600">Cadastre uma categoria antes de criar produtos.</p>
      ) : (
        <ProductForm categories={categories as Category[]} optionGroups={(optionGroups ?? []) as OptionGroup[]} />
      )}
    </div>
  );
}
