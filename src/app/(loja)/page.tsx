import Image from "next/image";
import Link from "next/link";
import { Clock, Bike, Store, ArrowRight, Wallet, Banknote, QrCode } from "lucide-react";
import {
  getBannerPromotions,
  getBestSellers,
  getBusinessHours,
  getCategoriesWithProducts,
  getSettings,
} from "@/lib/queries/catalogo";
import { todayHoursLabel } from "@/lib/horario";
import { promotionTagLabel } from "@/lib/promocoes";
import { ICONES_POR_CATEGORIA, ICONE_CATEGORIA_PADRAO } from "@/lib/categoria-icones";
import { ProdutoCard } from "@/components/site/produto-card";
import { BotaoWhatsApp } from "@/components/site/botao-whatsapp";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const CORES_ICONE_CATEGORIA = [
  "from-brand-500 to-brand-700",
  "from-tomato-500 to-tomato-600",
  "from-accent-500 to-accent-600",
  "from-whatsapp-500 to-whatsapp-600",
];

export default async function HomePage() {
  const [settings, hours, categories, bestSellers, banners] = await Promise.all([
    getSettings(),
    getBusinessHours(),
    getCategoriesWithProducts(),
    getBestSellers(),
    getBannerPromotions(),
  ]);

  const formasPagamento = [
    settings.payment_pix && { label: "Pix", icon: QrCode },
    settings.payment_cash && { label: "Dinheiro", icon: Banknote },
    settings.payment_card && { label: "Cartão", icon: Wallet },
  ].filter((v): v is { label: string; icon: typeof QrCode } => Boolean(v));

  return (
    <div className="space-y-10">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl text-cream-50 shadow-xl shadow-brand-900/15">
        {settings.banner_url ? (
          <div className="absolute inset-0">
            <Image src={settings.banner_url} alt="" fill priority className="object-cover" />
            <div className="absolute inset-0 bg-linear-to-t from-brand-900/95 via-brand-900/60 to-brand-900/20" />
          </div>
        ) : (
          <div
            className="bg-dot-pattern absolute inset-0 bg-linear-to-br from-brand-700 via-brand-800 to-tomato-800"
            aria-hidden
          >
            <div className="absolute -left-16 -top-16 h-64 w-64 rounded-full bg-accent-400/30 blur-3xl" />
            <div className="absolute right-0 top-1/3 h-48 w-48 rounded-full bg-tomato-400/25 blur-3xl" />
            <div className="absolute -bottom-16 left-1/4 h-56 w-56 rounded-full bg-brand-300/20 blur-3xl" />
          </div>
        )}

        <div className="relative z-10 space-y-4 px-5 py-10">
          <h1 className="text-2xl font-extrabold leading-tight tracking-tight text-white drop-shadow-sm sm:text-3xl">
            {settings.business_name}
          </h1>
          <p className="max-w-md text-sm text-cream-100/90 sm:text-base">
            Sabor de padaria artesanal e lanches feitos na hora. Peça pelo cardápio digital.
          </p>

          <div className="flex flex-wrap gap-2 pt-1">
            <Badge tone="neutral" className="gap-1.5 bg-white/15 text-white backdrop-blur-sm">
              <Clock className="h-3.5 w-3.5" aria-hidden /> {todayHoursLabel(hours)}
            </Badge>
            {settings.accepts_delivery && (
              <Badge tone="neutral" className="gap-1.5 bg-white/15 text-white backdrop-blur-sm">
                <Bike className="h-3.5 w-3.5" aria-hidden /> Entrega ~{settings.avg_delivery_minutes} min
              </Badge>
            )}
            {settings.accepts_pickup && (
              <Badge tone="neutral" className="gap-1.5 bg-white/15 text-white backdrop-blur-sm">
                <Store className="h-3.5 w-3.5" aria-hidden /> Retirada ~{settings.avg_pickup_minutes} min
              </Badge>
            )}
          </div>

          {formasPagamento.length > 0 && (
            <div className="flex flex-wrap items-center gap-3 pt-1 text-xs text-cream-100/80">
              <span>Aceitamos:</span>
              {formasPagamento.map(({ label, icon: Icon }) => (
                <span key={label} className="flex items-center gap-1">
                  <Icon className="h-3.5 w-3.5" aria-hidden /> {label}
                </span>
              ))}
            </div>
          )}

          <div className="flex flex-wrap gap-3 pt-3">
            <BotaoWhatsApp numero={settings.whatsapp_number} mensagem={`Olá! Vim pelo site da ${settings.business_name}.`} />
            <Link href="/cardapio">
              <Button
                variant="secondary"
                size="lg"
                className="border border-white/20 bg-white/95 text-brand-800 hover:bg-white"
              >
                Peça agora
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Button>
            </Link>
          </div>
        </div>
      </section>

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
                      <Image src={promo.image_url} alt="" fill className="object-cover" />
                      <div className="absolute inset-0 bg-linear-to-t from-brand-900/90 via-brand-900/40 to-transparent" />
                    </div>
                  ) : (
                    <div className="h-32 w-full bg-linear-to-br from-accent-500 to-tomato-600" aria-hidden />
                  )}
                  <div className="absolute inset-0 flex flex-col justify-end p-4">
                    {tag && (
                      <span className="mb-1.5 inline-flex w-fit items-center rounded-full bg-tomato-500 px-2.5 py-0.5 text-xs font-bold">
                        {tag}
                      </span>
                    )}
                    <p className="font-semibold leading-tight">{promo.title}</p>
                    {promo.description && (
                      <p className="mt-0.5 line-clamp-2 text-xs text-cream-100/85">{promo.description}</p>
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
            const Icone = ICONES_POR_CATEGORIA[cat.slug] ?? ICONE_CATEGORIA_PADRAO;
            const cor = CORES_ICONE_CATEGORIA[i % CORES_ICONE_CATEGORIA.length];
            return (
              <Link
                key={cat.id}
                href={`/cardapio?categoria=${cat.slug}`}
                className="flex min-w-[104px] shrink-0 snap-start flex-col items-center gap-2 rounded-2xl border border-brand-900/10 bg-white p-4 text-center shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md sm:min-w-0"
              >
                <span className={`flex h-14 w-14 items-center justify-center rounded-full bg-linear-to-br ${cor} text-white shadow-sm`}>
                  <Icone className="h-7 w-7" aria-hidden />
                </span>
                <span className="text-xs font-semibold text-stone-700">{cat.name}</span>
                <span className="text-[11px] text-stone-400">
                  {cat.products.length} {cat.products.length === 1 ? "item" : "itens"}
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Mais vendidos — carrossel com fotos grandes */}
      {bestSellers.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-brand-900">Mais vendidos</h2>
            <Link href="/cardapio" className="text-sm font-medium text-brand-700 hover:text-brand-800">
              Ver cardápio
            </Link>
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
        <p className="mt-1 text-sm text-cream-100/90">Peça agora e receba fresquinho, na hora.</p>
        <Link href="/cardapio" className="mt-4 inline-block">
          <Button variant="secondary" size="lg" className="bg-white text-brand-800 hover:bg-cream-50">
            Peça agora
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Button>
        </Link>
      </section>
    </div>
  );
}
