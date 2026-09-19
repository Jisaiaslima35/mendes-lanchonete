import { getCategoriesWithProducts } from "@/lib/queries/catalogo";
import { CarrinhoConteudo } from "./carrinho-conteudo";

/**
 * /carrinho. Carrega categorias ativas e produtos complementares (cross-sell)
 * no servidor para popular os atalhos e a seção "Peça também".
 */
export default async function CarrinhoPage() {
  const categoriesWithProducts = await getCategoriesWithProducts();

  const categories = categoriesWithProducts.map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
  }));

  const complementares = categoriesWithProducts
    .filter((c) => {
      const s = c.slug.toLowerCase();
      const n = c.name.toLowerCase();
      return (
        s.includes("bebida") ||
        s.includes("sobremesa") ||
        s.includes("doce") ||
        s.includes("suco") ||
        n.includes("bebida") ||
        n.includes("sobremesa") ||
        n.includes("adicion")
      );
    })
    .flatMap((c) => c.products);

  const pool =
    complementares.length > 0
      ? complementares
      : categoriesWithProducts.flatMap((c) => c.products);

  const crossSellProducts = pool
    .filter((p) => p.is_active && p.is_available)
    .slice(0, 10);

  return (
    <CarrinhoConteudo
      categories={categories}
      crossSellProducts={crossSellProducts}
    />
  );
}
