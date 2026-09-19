"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShoppingBag } from "lucide-react";
import { useCarrinho } from "@/lib/carrinho/contexto";
import { useMesa } from "@/lib/mesa/contexto";
import { formatCurrency, pluralize } from "@/lib/utils";

// Rotas onde já existe um CTA "Finalizar pedido" ou o layout é especializado,
// pra que a barra flutuante não cubra o botão principal nem polua a tela.
// `/produto/*` mostra a barra do carrinho inline (CarrinhoInline) na própria
// página de detalhe — então escondemos a versão flutuante lá.
const ROTAS_OCULTAS = new Set(["/carrinho", "/checkout"]);
const ESCONDIDOS_PREFIXO = ["/produto/"];

export function CarrinhoBar() {
  const pathname = usePathname();
  const { mesa } = useMesa();
  const { totalItens, subtotal, isHidratado } = useCarrinho();

  // Preserva ?mesa=X quando o cliente veio de um QR Code de mesa.
  const carrinhoHref = mesa ? `/carrinho?mesa=${encodeURIComponent(mesa)}` : "/carrinho";

  if (!isHidratado || totalItens === 0) return null;
  if (pathname && ROTAS_OCULTAS.has(pathname)) return null;
  if (pathname && ESCONDIDOS_PREFIXO.some((p) => pathname.startsWith(p))) return null;

  return (
    <div className="animate-fade-up fixed inset-x-0 bottom-0 z-40 p-3">
      <Link
        href={carrinhoHref}
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
