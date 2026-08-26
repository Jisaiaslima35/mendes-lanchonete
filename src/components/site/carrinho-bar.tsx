"use client";

import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { useCarrinho } from "@/lib/carrinho/contexto";
import { formatCurrency, pluralize } from "@/lib/utils";

export function CarrinhoBar() {
  const { totalItens, subtotal, isHidratado } = useCarrinho();

  if (!isHidratado || totalItens === 0) return null;

  return (
    <div className="animate-fade-up fixed inset-x-0 bottom-0 z-40 p-3">
      <Link
        href="/carrinho"
        className="mx-auto flex max-w-3xl items-center justify-between rounded-2xl bg-linear-to-r from-brand-600 to-brand-700 px-5 py-3.5 text-white shadow-lg shadow-brand-900/30 transition-transform active:scale-[0.99]"
      >
        <span className="flex items-center gap-2 font-semibold">
          <span className="relative flex h-7 w-7 items-center justify-center rounded-full bg-white/20">
            <ShoppingBag className="h-4 w-4" aria-hidden />
            <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-accent-500 text-[11px] font-bold text-brand-900">
              {totalItens}
            </span>
          </span>
          {pluralize(totalItens, "item", "itens")}
        </span>
        <span className="font-bold">Ver carrinho — {formatCurrency(subtotal)}</span>
      </Link>
    </div>
  );
}
