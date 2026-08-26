import { notFound } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { CategoryForm } from "@/components/admin/category-form";
import type { Category } from "@/types/database";

export default async function EditarCategoriaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabase();
  const { data } = await supabase.from("categories").select("*").eq("id", id).single();
  if (!data) notFound();

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-stone-900">Editar categoria</h1>
      <CategoryForm category={data as Category} />
    </div>
  );
}
