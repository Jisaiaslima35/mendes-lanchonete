import Image from "next/image";
import { notFound } from "next/navigation";
import { getProductBySlug, getCategories } from "@/lib/queries/catalogo";
import { formatCurrency } from "@/lib/utils";
import { ProdutoPersonalizacao } from "@/components/site/produto-personalizacao";

export default async function ProdutoPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [product, categorias] = await Promise.all([
    getProductBySlug(slug),
    getCategories(),
  ]);
  if (!product) notFound();

  const temPromo = product.promo_price != null;

  return (
    <div className="space-y-5">
      <div className="relative -mx-4 h-64 w-[calc(100%+2rem)] overflow-hidden bg-brand-50 shadow-sm sm:mx-0 sm:w-full sm:rounded-2xl">
        {product.image_url ? (
          <Image src={product.image_url} alt={product.name} fill className="object-cover" priority />
        ) : (
          <div className="flex h-full items-center justify-center text-6xl" aria-hidden>
            🍽️
          </div>
        )}
        {temPromo && (
          <span className="absolute left-3 top-3 rounded-full bg-tomato-500 px-3 py-1 text-xs font-bold text-white shadow-sm">
            OFERTA
          </span>
        )}
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">
          {product.category.name}
        </p>
        <h1 className="mt-0.5 text-2xl font-extrabold tracking-tight text-brand-900">{product.name}</h1>
        {product.description && <p className="mt-1.5 text-stone-600">{product.description}</p>}
        <div className="mt-3 flex items-center gap-2">
          {temPromo && (
            <span className="text-base text-stone-400 line-through">
              {formatCurrency(product.price)}
            </span>
          )}
          <span className="text-2xl font-extrabold text-brand-800">
            {formatCurrency(product.promo_price ?? product.price)}
          </span>
        </div>
        <p className="mt-1 text-xs text-stone-500">Tempo de preparo: ~{product.prep_minutes} min</p>
      </div>

      <ProdutoPersonalizacao product={product} categorias={categorias} />
    </div>
  );
}
