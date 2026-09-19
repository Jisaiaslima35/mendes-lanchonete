import Image from "next/image";
import { PreserveMesaLink } from "@/components/site/preserve-mesa-link";
import { ArrowRight } from "lucide-react";
import {
  getBannerPromotions,
  getBestSellers,
  getCategoriesWithProducts,
} from "@/lib/queries/catalogo";
import { promotionTagLabel } from "@/lib/promocoes";
import {
  ICONES_POR_CATEGORIA,
  ICONE_CATEGORIA_PADRAO,
} from "@/lib/categoria-icones";
import { ProdutoCard } from "@/components/site/produto-card";
import { Button } from "@/components/ui/button";

const CORES_ICONE_CATEGORIA = [
  "from-brand-500 to-brand-700",
  "from-tomato-500 to-tomato-600",
  "from-accent-500 to-accent-600",
  "from-whatsapp-500 to-whatsapp-600",
];

export default async function HomePage() {
  const [categories, bestSellers, banners] = await Promise.all([
    getCategoriesWithProducts(),
    getBestSellers(),
    getBannerPromotions(),
  ]);

  return (
    <div className="space-y-10">

      {/* Promoções — logo após o hero, acima da dobra */}
      {banners.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-bold text-brand-900">Promoções</h2>
          <div className="flex snap-x gap-4 overflow-x-auto pb-1">
            {banners.map((promo) => {
              const tag = promotionTagLabel(promo);
              return (
                <div
                  key={promo.id}
                  className="relative min-w-[260px] snap-start overflow-hidden rounded-2xl bg-brand-800 text-white shadow-md"
                >
                  {promo.image_url ? (
                    <div className="relative h-32 w-full">
                      <Image
                        src={promo.image_url}
                        alt=""
                        fill
                        className="object-cover"
                      />
                      <div className="absolute inset-0 bg-linear-to-t from-brand-900/90 via-brand-900/40 to-transparent" />
                    </div>
                  ) : (
                    <div
                      className="h-32 w-full bg-linear-to-br from-accent-500 to-tomato-600"
                      aria-hidden
                    />
                  )}
                  <div className="absolute inset-0 flex flex-col justify-end p-4">
                    {tag && (
                      <span className="mb-1.5 inline-flex w-fit items-center rounded-full bg-tomato-500 px-2.5 py-0.5 text-xs font-bold">
                        {tag}
                      </span>
                    )}
                    <p className="font-semibold leading-tight">{promo.title}</p>
                    {promo.description && (
                      <p className="mt-0.5 line-clamp-2 text-xs text-cream-100/85">
                        {promo.description}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Categorias */}
      <section className="space-y-3">
        <h2 className="text-lg font-bold text-brand-900">Categorias</h2>
        <div className="flex snap-x gap-3 overflow-x-auto pb-1 sm:grid sm:grid-cols-3 sm:overflow-visible">
          {categories.map((cat, i) => {
            const Icone =
              ICONES_POR_CATEGORIA[cat.slug] ?? ICONE_CATEGORIA_PADRAO;
            const cor = CORES_ICONE_CATEGORIA[i % CORES_ICONE_CATEGORIA.length];
            return (
              <PreserveMesaLink
                key={cat.id}
                href={`/cardapio?categoria=${cat.slug}`}
                className="flex min-w-[104px] shrink-0 snap-start flex-col items-center gap-2 rounded-2xl border border-brand-900/10 bg-white p-4 text-center shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md sm:min-w-0"
              >
                <span
                  className={`flex h-14 w-14 items-center justify-center rounded-full bg-linear-to-br ${cor} text-white shadow-sm`}
                >
                  <Icone className="h-7 w-7" aria-hidden />
                </span>
                <span className="text-xs font-semibold text-stone-700">
                  {cat.name}
                </span>
                <span className="text-[11px] text-stone-400">
                  {cat.products.length}{" "}
                  {cat.products.length === 1 ? "item" : "itens"}
                </span>
              </PreserveMesaLink>
            );
          })}
        </div>
      </section>

      {/* Mais vendidos — carrossel com fotos grandes */}
      {bestSellers.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-brand-900">Mais vendidos</h2>
            <PreserveMesaLink
              href="/cardapio"
              className="text-sm font-medium text-brand-700 hover:text-brand-800"
            >
              Ver cardápio
            </PreserveMesaLink>
          </div>
          <div className="flex snap-x gap-3 overflow-x-auto pb-1">
            {bestSellers.map((product, i) => (
              <div
                key={product.id}
                className="animate-fade-up snap-start"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <ProdutoCard product={product} destaque />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* CTA de conversão final */}
      <section className="overflow-hidden rounded-2xl bg-linear-to-r from-brand-700 to-tomato-700 px-5 py-7 text-center text-white shadow-md">
        <p className="text-lg font-bold">Com fome? 😋</p>
        <p className="mt-1 text-sm text-cream-100/90">
          Peça agora e receba fresquinho, na hora.
        </p>
        <PreserveMesaLink href="/cardapio" className="mt-4 inline-block">
          <Button
            variant="secondary"
            size="lg"
            className="bg-white text-brand-800 hover:bg-cream-50"
          >
            Peça agora
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Button>
        </PreserveMesaLink>
      </section>
    </div>
  );
}
