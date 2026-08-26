import { notFound } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { PromotionForm } from "@/components/admin/promotion-form";
import type { Promotion } from "@/types/database";

export default async function EditarPromocaoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabase();
  const { data } = await supabase.from("promotions").select("*").eq("id", id).single();
  if (!data) notFound();

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-stone-900">Editar promoção</h1>
      <PromotionForm promotion={data as Promotion} />
    </div>
  );
}
