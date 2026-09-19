import { getCategoriesWithProducts, getPromotionProducts } from "@/lib/queries/catalogo";
import { ProdutoCard } from "@/components/site/produto-card";

export default async function CardapioPage({
  searchParams,
}: {
  searchParams: Promise<{ categoria?: string }>;
}) {
  const { categoria } = await searchParams;
  const [categories, promoProducts] = await Promise.all([
    getCategoriesWithProducts(),
    getPromotionProducts(),
  ]);

  const visibleCategories = categoria
    ? categories.filter((c) => c.slug === categoria)
    : categories;

  return (
    // scroll-smooth: links com âncora #slug descem com animação nativa.
    <div className="scroll-smooth space-y-8">
      <h1 className="text-xl font-bold text-brand-900">Cardápio</h1>

      {!categoria && promoProducts.length > 0 && (
        <section id="promocoes" className="space-y-2">
          <h2 className="flex items-center gap-1.5 text-lg font-bold text-tomato-600">🔥 Promoções</h2>
          <div className="space-y-3">
            {promoProducts.map((p) => (
              <ProdutoCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}

      {visibleCategories.map((cat) => (
        <section key={cat.id} id={cat.slug} className="space-y-2">
          <h2 className="text-lg font-bold text-brand-900">{cat.name}</h2>
          {cat.products.length === 0 ? (
            <p className="text-sm text-stone-500">Nenhum produto nesta categoria no momento.</p>
          ) : (
            <div className="space-y-3">
              {cat.products.map((p) => (
                <ProdutoCard key={p.id} product={p} categorySlug={cat.slug} />
              ))}
            </div>
          )}
        </section>
      ))}
    </div>
  );
}
