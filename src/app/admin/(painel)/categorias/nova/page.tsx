import { CategoryForm } from "@/components/admin/category-form";

export default function NovaCategoriaPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-stone-900">Nova categoria</h1>
      <CategoryForm />
    </div>
  );
}
