import Image from "next/image";
import Link from "next/link";
import { Plus } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { ICONES_POR_CATEGORIA, ICONE_CATEGORIA_PADRAO } from "@/lib/categoria-icones";
import { Badge } from "@/components/ui/badge";
import type { Product } from "@/types/database";

function PlaceholderFoto({ categorySlug, className }: { categorySlug?: string; className?: string }) {
  const Icone = (categorySlug && ICONES_POR_CATEGORIA[categorySlug]) || ICONE_CATEGORIA_PADRAO;
  return (
    <div
      className={`flex items-center justify-center bg-linear-to-br from-brand-100 via-accent-100 to-brand-200 ${className ?? ""}`}
      aria-hidden
    >
      <Icone className="h-9 w-9 text-brand-500/70" strokeWidth={1.5} />
    </div>
  );
}

export function ProdutoCard({
  product,
  categorySlug,
  destaque = false,
}: {
  product: Product;
  categorySlug?: string;
  destaque?: boolean;
}) {
  const temPromo = product.promo_price != null;

  if (destaque) {
    return (
      <Link
        href={`/produto/${product.slug}`}
        className="flex w-56 shrink-0 flex-col overflow-hidden rounded-2xl border border-brand-900/10 bg-white shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg active:scale-[0.98]"
      >
        <div className="relative h-36 w-full">
          {product.image_url ? (
            <Image src={product.image_url} alt={product.name} fill sizes="224px" className="object-cover" />
          ) : (
            <PlaceholderFoto categorySlug={categorySlug} className="h-full w-full" />
          )}
          {temPromo && (
            <span className="absolute left-2 top-2 rounded-full bg-tomato-500 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm">
              OFERTA
            </span>
          )}
          {!product.is_available && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/85">
              <Badge tone="neutral">Esgotado</Badge>
            </div>
          )}
        </div>
        <div className="flex flex-1 flex-col gap-1 p-3">
          <h3 className="line-clamp-1 font-semibold text-brand-900">{product.name}</h3>
          {product.description && (
            <p className="line-clamp-2 text-xs text-stone-600 leading-relaxed">{product.description}</p>
          )}
          <div className="mt-auto flex items-center justify-between gap-2 pt-1.5">
            <div className="flex flex-col">
              {temPromo && (
                <span className="text-xs text-stone-400 line-through">{formatCurrency(product.price)}</span>
              )}
              <span className="font-extrabold text-brand-900">
                {formatCurrency(product.promo_price ?? product.price)}
              </span>
            </div>
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white shadow-xs transition-transform duration-200 ease-out hover:scale-110 hover:bg-brand-700 active:scale-90">
              <Plus className="h-4 w-4" />
            </span>
          </div>
        </div>
      </Link>
    );
  }

  return (
    <Link
      href={`/produto/${product.slug}`}
      className="group flex gap-3 rounded-2xl border border-brand-900/10 bg-white p-3 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md active:scale-[0.99]"
    >
      <div className="relative h-28 w-28 shrink-0 overflow-hidden rounded-xl shadow-inner">
        {product.image_url ? (
          <Image src={product.image_url} alt={product.name} fill sizes="112px" className="object-cover transition-transform duration-300 group-hover:scale-105" />
        ) : (
          <PlaceholderFoto categorySlug={categorySlug} className="h-full w-full" />
        )}
        {temPromo && (
          <span className="absolute left-1 top-1 rounded-full bg-tomato-500 px-1.5 py-0.5 text-[10px] font-bold text-white shadow-xs">
            OFERTA
          </span>
        )}
        {!product.is_available && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/85">
            <Badge tone="neutral">Esgotado</Badge>
          </div>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col justify-between">
        <div>
          <h3 className="truncate font-semibold text-brand-900 group-hover:text-brand-700 transition-colors">{product.name}</h3>
          {product.description && (
            <p className="mt-0.5 line-clamp-2 text-sm text-stone-600 leading-snug">{product.description}</p>
          )}
        </div>
        <div className="mt-1.5 flex items-center justify-between gap-2">
          <div className="flex flex-wrap items-baseline gap-1.5">
            {temPromo && (
              <span className="text-xs text-stone-400 line-through">{formatCurrency(product.price)}</span>
            )}
            <span className="font-extrabold text-brand-900">
              {formatCurrency(product.promo_price ?? product.price)}
            </span>
          </div>
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white shadow-xs transition-transform duration-200 ease-out group-hover:scale-110 group-hover:bg-brand-700 active:scale-90"
            aria-hidden
          >
            <Plus className="h-4 w-4" />
          </span>
        </div>
      </div>
    </Link>
  );
}
