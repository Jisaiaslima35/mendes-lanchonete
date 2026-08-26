"use client";

import Image from "next/image";
import Link from "next/link";
import { Minus, Plus, Trash2, ShoppingBag } from "lucide-react";
import { useCarrinho } from "@/lib/carrinho/contexto";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export default function CarrinhoPage() {
  const { itens, subtotal, isHidratado, alterarQuantidade, removerItem, totalDaLinha } = useCarrinho();

  if (isHidratado && itens.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <ShoppingBag className="h-12 w-12 text-stone-300" aria-hidden />
        <p className="font-medium text-stone-700">Seu carrinho está vazio.</p>
        <Link href="/cardapio">
          <Button>Ver cardápio</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-brand-900">Seu carrinho</h1>

      <ul className="space-y-3">
        {itens.map((item) => (
          <li key={item.lineId} className="flex gap-3 rounded-2xl border border-brand-900/10 bg-white p-3 shadow-sm">
            <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-brand-50">
              {item.imageUrl ? (
                <Image src={item.imageUrl} alt={item.productName} fill sizes="64px" className="object-cover" />
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
                  {item.notes && <p className="mt-0.5 text-sm italic text-stone-400">Obs: {item.notes}</p>}
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
                <span className="font-bold text-brand-800">{formatCurrency(totalDaLinha(item))}</span>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <div className="space-y-1 rounded-2xl border border-brand-900/10 bg-white p-4 shadow-sm">
        <div className="flex justify-between text-sm text-stone-600">
          <span>Subtotal</span>
          <span className="font-semibold text-brand-900">{formatCurrency(subtotal)}</span>
        </div>
        <p className="text-xs text-stone-400">Taxa de entrega e descontos são calculados no checkout.</p>
      </div>

      <Link href="/checkout">
        <Button size="lg" className="w-full">
          Continuar para o checkout
        </Button>
      </Link>
    </div>
  );
}
