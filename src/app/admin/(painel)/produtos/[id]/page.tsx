import { notFound } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { getCurrentTenantId } from "@/lib/tenant";
import { ProductForm } from "@/components/admin/product-form";
import type { Category, OptionGroup, Product } from "@/types/database";

export default async function EditarProdutoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabase();
  const tenantId = await getCurrentTenantId();

  const [{ data: product }, { data: categories }, { data: optionGroups }, { data: links }] = await Promise.all([
    supabase.from("products").select("*").eq("id", id).single(),
    supabase.from("categories").select("*").eq("tenant_id", tenantId).order("sort_order"),
    supabase.from("option_groups").select("*").eq("tenant_id", tenantId).order("sort_order"),
    supabase.from("product_option_groups").select("group_id").eq("product_id", id),
  ]);
  if (!product) notFound();

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-stone-900">Editar produto</h1>
      <ProductForm
        product={product as Product}
        categories={(categories ?? []) as Category[]}
        optionGroups={(optionGroups ?? []) as OptionGroup[]}
        linkedGroupIds={(links ?? []).map((l) => l.group_id)}
      />
    </div>
  );
}
