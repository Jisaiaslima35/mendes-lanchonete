import { getNeighborhoods, getSettings } from "@/lib/queries/catalogo";
import { CheckoutForm } from "@/components/site/checkout-form";

export default async function CheckoutPage() {
  const [settings, neighborhoods] = await Promise.all([getSettings(), getNeighborhoods()]);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-brand-900">Finalizar pedido</h1>
      <CheckoutForm settings={settings} neighborhoods={neighborhoods} />
    </div>
  );
}
