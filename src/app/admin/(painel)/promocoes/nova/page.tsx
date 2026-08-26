import { PromotionForm } from "@/components/admin/promotion-form";

export default function NovaPromocaoPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-stone-900">Nova promoção</h1>
      <PromotionForm />
    </div>
  );
}
