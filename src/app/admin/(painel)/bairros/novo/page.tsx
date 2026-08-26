import { NeighborhoodForm } from "@/components/admin/neighborhood-form";

export default function NovoBairroPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-stone-900">Novo bairro</h1>
      <NeighborhoodForm />
    </div>
  );
}
