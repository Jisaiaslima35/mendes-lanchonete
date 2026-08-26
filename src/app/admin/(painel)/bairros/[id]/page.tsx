import { notFound } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { NeighborhoodForm } from "@/components/admin/neighborhood-form";
import type { Neighborhood } from "@/types/database";

export default async function EditarBairroPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabase();
  const { data } = await supabase.from("neighborhoods").select("*").eq("id", id).single();
  if (!data) notFound();

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-stone-900">Editar bairro</h1>
      <NeighborhoodForm neighborhood={data as Neighborhood} />
    </div>
  );
}
