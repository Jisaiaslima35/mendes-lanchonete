"use client";

import { ShoppingBag } from "lucide-react";
import { useCarrinho } from "@/lib/carrinho/contexto";
import { formatCurrency, pluralize } from "@/lib/utils";
import { PreserveMesaLink } from "@/components/site/preserve-mesa-link";

/**
 * Versão "inline" (não flutuante) da barra do carrinho — usada na página de
 * detalhe do produto, abaixo do botão Adicionar, pra que o cliente possa
 * encerrar o pedido dali mesmo sem que o floating bar cubra o CTA principal.
 */
export function CarrinhoInline() {
  const { totalItens, subtotal, isHidratado } = useCarrinho();

  if (!isHidratado || totalItens === 0) return null;

  return (
    <PreserveMesaLink
      href="/carrinho"
      className="flex items-center justify-between rounded-2xl border border-brand-900/10 bg-white px-4 py-3 text-brand-800 shadow-sm transition-transform active:scale-[0.99]"
    >
      <span className="flex items-center gap-2 font-semibold">
        <span className="relative flex h-7 w-7 items-center justify-center rounded-full bg-brand-100">
          <ShoppingBag className="h-4 w-4" aria-hidden />
          <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-accent-500 text-[11px] font-bold text-brand-900">
            {totalItens}
          </span>
        </span>
        {pluralize(totalItens, "item", "itens")} no carrinho
      </span>
      <span className="font-bold">Ver carrinho — {formatCurrency(subtotal)}</span>
    </PreserveMesaLink>
  );
}
