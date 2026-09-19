"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Minus, Plus, Trash2, ShoppingBag, Check } from "lucide-react";
import { useState } from "react";
import { useCarrinho } from "@/lib/carrinho/contexto";
import { useMesa } from "@/lib/mesa/contexto";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { PreserveMesaLink } from "@/components/site/preserve-mesa-link";
import { ICONES_POR_CATEGORIA, ICONE_CATEGORIA_PADRAO } from "@/lib/categoria-icones";
import type { Product } from "@/types/database";

export interface CategorySummary {
  id: string;
  name: string;
  slug: string;
}

export function CarrinhoConteudo({
  categories = [],
  crossSellProducts = [],
}: {
  categories?: CategorySummary[];
  crossSellProducts?: Product[];
}) {
  const {
    itens,
    subtotal,
    isHidratado,
    alterarQuantidade,
    removerItem,
    totalDaLinha,
    adicionarItem,
  } = useCarrinho();
  const { mesa } = useMesa();
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());

  const checkoutHref = mesa ? `/checkout?mesa=${encodeURIComponent(mesa)}` : "/checkout";

  if (isHidratado && itens.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <ShoppingBag className="h-12 w-12 text-stone-300" aria-hidden />
        <p className="font-medium text-stone-700">Seu carrinho está vazio.</p>
        <PreserveMesaLink href="/cardapio">
          <Button>Ver cardápio</Button>
        </PreserveMesaLink>
      </div>
    );
  }

  function handleAddCrossSell(prod: Product) {
    adicionarItem({
      productId: prod.id,
      productSlug: prod.slug,
      productName: prod.name,
      unitPrice: prod.promo_price ?? prod.price,
      quantity: 1,
      imageUrl: prod.image_url ?? null,
      options: [],
    });
    setAddedIds((prev) => {
      const next = new Set(prev);
      next.add(prod.id);
      return next;
    });
    setTimeout(() => {
      setAddedIds((prev) => {
        const next = new Set(prev);
        next.delete(prod.id);
        return next;
      });
    }, 1800);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Link
          href="/"
          aria-label="Voltar para o cardápio"
          className="inline-flex h-9 w-9 items-center justify-center rounded-full text-brand-700 transition hover:bg-brand-50"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
        </Link>
        <h1 className="text-xl font-bold text-brand-900">Seu carrinho</h1>
      </div>

      {/* Lista de itens escolhidos */}
      <ul className="space-y-3">
        {itens.map((item) => (
          <li
            key={item.lineId}
            className="flex gap-3 rounded-2xl border border-brand-900/10 bg-white p-3 shadow-sm"
          >
            <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-brand-50">
              {item.imageUrl ? (
                <Image
                  src={item.imageUrl}
                  alt={item.productName}
                  fill
                  sizes="64px"
                  className="object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-2xl" aria-hidden>
                  🍽️
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-brand-900">{item.productName}</p>
                  {item.options.length > 0 && (
                    <ul className="mt-0.5 text-sm text-stone-500">
                      {item.options.map((o) => (
                        <li key={o.id}>+ {o.optionName}</li>
                      ))}
                    </ul>
                  )}
                  {item.notes && (
                    <p className="mt-0.5 text-sm italic text-stone-400">Obs: {item.notes}</p>
                  )}
                </div>
                <button
                  type="button"
                  aria-label={`Remover ${item.productName}`}
                  onClick={() => removerItem(item.lineId)}
                  className="shrink-0 rounded p-1.5 text-stone-400 hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <div className="flex items-center gap-2 rounded-lg border border-stone-300 px-2 py-1">
                  <button
                    type="button"
                    aria-label="Diminuir quantidade"
                    onClick={() => alterarQuantidade(item.lineId, item.quantity - 1)}
                    className="flex h-6 w-6 items-center justify-center rounded text-stone-600 hover:bg-stone-100"
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <span className="w-4 text-center text-sm font-medium">{item.quantity}</span>
                  <button
                    type="button"
                    aria-label="Aumentar quantidade"
                    onClick={() => alterarQuantidade(item.lineId, item.quantity + 1)}
                    className="flex h-6 w-6 items-center justify-center rounded text-stone-600 hover:bg-stone-100"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
                <span className="font-extrabold text-brand-900">
                  {formatCurrency(totalDaLinha(item))}
                </span>
              </div>
            </div>
          </li>
        ))}
      </ul>

      {/* 1. Atalho de categorias deslizável (sem beco sem saída) */}
      {categories.length > 0 && (
        <div className="space-y-2 pt-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-stone-500">
              Continuar pedindo
            </span>
            <PreserveMesaLink
              href="/cardapio"
              className="text-xs font-semibold text-brand-700 hover:text-brand-800"
            >
              Ver cardápio completo →
            </PreserveMesaLink>
          </div>
          <div className="flex gap-2 overflow-x-auto whitespace-nowrap pb-1 scrollbar-none [scrollbar-width:none]">
            {categories.map((cat) => {
              const Icone = ICONES_POR_CATEGORIA[cat.slug] ?? ICONE_CATEGORIA_PADRAO;
              return (
                <PreserveMesaLink
                  key={cat.id}
                  href={`/cardapio#${cat.slug}`}
                  className="inline-flex items-center gap-1.5 rounded-full border border-brand-900/10 bg-white px-3.5 py-1.5 text-xs font-semibold text-stone-700 shadow-xs transition-all hover:border-brand-500 hover:bg-brand-50 hover:text-brand-900 active:scale-95"
                >
                  <Icone className="h-3.5 w-3.5 text-brand-600" aria-hidden />
                  <span>{cat.name}</span>
                </PreserveMesaLink>
              );
            })}
          </div>
        </div>
      )}

      {/* 2. Seção "Que tal adicionar? 🥤" / Cross-sell com 1 clique */}
      {crossSellProducts.length > 0 && (
        <div className="space-y-2.5 pt-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="text-base" aria-hidden>
                🥤
              </span>
              <h2 className="text-sm font-bold text-brand-900">Que tal adicionar?</h2>
            </div>
            <span className="text-[11px] font-medium text-stone-400">Peça com 1 clique</span>
          </div>

          <div className="flex snap-x gap-2.5 overflow-x-auto pb-1 scrollbar-none [scrollbar-width:none]">
            {crossSellProducts.map((prod) => {
              const isAdded = addedIds.has(prod.id);
              const preco = prod.promo_price ?? prod.price;

              return (
                <div
                  key={prod.id}
                  className="flex w-36 shrink-0 snap-start flex-col justify-between rounded-xl border border-brand-900/10 bg-white p-2.5 shadow-xs transition-all hover:border-brand-300 hover:shadow-sm"
                >
                  <div>
                    <div className="relative h-20 w-full overflow-hidden rounded-lg bg-brand-50">
                      {prod.image_url ? (
                        <Image
                          src={prod.image_url}
                          alt={prod.name}
                          fill
                          sizes="144px"
                          className="object-cover"
                        />
                      ) : (
                        <div
                          className="flex h-full items-center justify-center text-2xl"
                          aria-hidden
                        >
                          🥤
                        </div>
                      )}
                    </div>
                    <p
                      className="mt-1.5 line-clamp-1 text-xs font-semibold text-stone-900"
                      title={prod.name}
                    >
                      {prod.name}
                    </p>
                  </div>

                  <div className="mt-2 flex items-center justify-between gap-1 pt-1">
                    <span className="text-xs font-extrabold text-brand-800">
                      {formatCurrency(preco)}
                    </span>
                    <button
                      type="button"
                      aria-label={`Adicionar ${prod.name} ao carrinho`}
                      onClick={() => handleAddCrossSell(prod)}
                      className={`flex h-7 w-7 items-center justify-center rounded-full text-white shadow-xs transition-all duration-200 active:scale-90 ${
                        isAdded
                          ? "bg-emerald-600 hover:bg-emerald-700 scale-105"
                          : "bg-brand-600 hover:bg-brand-700 hover:scale-110"
                      }`}
                      title="Adicionar ao carrinho"
                    >
                      {isAdded ? (
                        <Check className="h-3.5 w-3.5" />
                      ) : (
                        <Plus className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Resumo do subtotal */}
      <div className="space-y-1 rounded-2xl border border-brand-900/10 bg-white p-4 shadow-sm">
        <div className="flex justify-between text-sm text-stone-600">
          <span>Subtotal</span>
          <span className="font-semibold text-brand-900">{formatCurrency(subtotal)}</span>
        </div>
        <p className="text-xs text-stone-400">
          Taxa de entrega e descontos são calculados no checkout.
        </p>
      </div>

      <PreserveMesaLink href="/cardapio" className="block">
        <Button
          variant="outline"
          size="lg"
          className="w-full border-brand-300 bg-transparent text-brand-700 hover:bg-brand-50"
        >
          ← Adicionar mais itens do cardápio
        </Button>
      </PreserveMesaLink>

      {/* 3. Sticky Bottom Bar no Mobile com Total em Destaque */}
      <div className="sticky bottom-0 z-30 -mx-4 -mb-20 mt-4 border-t border-brand-900/10 bg-white/95 p-4 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] backdrop-blur-md">
        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-col">
            <span className="text-[11px] font-medium uppercase tracking-wider text-stone-500">
              Total estimado
            </span>
            <span className="text-lg font-black text-brand-900">
              {formatCurrency(subtotal)}
            </span>
          </div>
          <Link href={checkoutHref} className="flex-1 max-w-[220px]">
            <Button size="lg" className="w-full font-bold shadow-md shadow-brand-900/20">
              Continuar
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
