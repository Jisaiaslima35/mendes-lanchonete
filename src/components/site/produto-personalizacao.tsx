"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Minus, Plus } from "lucide-react";
import { useCarrinho } from "@/lib/carrinho/contexto";
import { effectivePrice, optionsTotalPerUnit } from "@/lib/precos";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea, Label, FieldGroup } from "@/components/ui/field";
import { AbasCategorias } from "@/components/site/abas-categorias";
import { CarrinhoInline } from "@/components/site/carrinho-inline";
import type { Category, ProductWithOptions } from "@/types/database";

export function ProdutoPersonalizacao({
  product,
  categorias,
}: {
  product: ProductWithOptions;
  categorias: Category[];
}) {
  const router = useRouter();
  const { adicionarItem } = useCarrinho();

  const [selected, setSelected] = useState<Record<string, string[]>>({});
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  const basePrice = effectivePrice(product);

  const selectedOptions = useMemo(() => {
    return product.option_groups.flatMap((group) =>
      (selected[group.id] ?? []).map((optionId) => {
        const option = group.options.find((o) => o.id === optionId)!;
        return { id: option.id, groupName: group.name, optionName: option.name, priceDelta: option.price_delta };
      }),
    );
  }, [selected, product.option_groups]);

  const unitTotal = basePrice + optionsTotalPerUnit(selectedOptions);
  const total = unitTotal * quantity;

  function toggleOption(groupId: string, optionId: string, selectionType: string, maxSelect: number | null) {
    setError(null);
    setSelected((prev) => {
      const current = prev[groupId] ?? [];
      if (selectionType === "single") {
        return { ...prev, [groupId]: [optionId] };
      }
      if (current.includes(optionId)) {
        return { ...prev, [groupId]: current.filter((id) => id !== optionId) };
      }
      if (maxSelect != null && current.length >= maxSelect) return prev;
      return { ...prev, [groupId]: [...current, optionId] };
    });
  }

  function handleAdicionar() {
    for (const group of product.option_groups) {
      const count = (selected[group.id] ?? []).length;
      if (group.is_required && count < Math.max(1, group.min_select)) {
        setError(`Escolha uma opção em "${group.name}".`);
        return;
      }
    }

    adicionarItem({
      productId: product.id,
      productSlug: product.slug,
      productName: product.name,
      imageUrl: product.image_url,
      unitPrice: basePrice,
      quantity,
      options: selectedOptions,
      notes: notes.trim() || undefined,
    });
    router.push("/carrinho");
  }

  return (
    <div className="space-y-6 pb-12">
      {product.option_groups.map((group) => (
        <fieldset key={group.id} className="space-y-2">
          <legend className="mb-1 flex items-baseline justify-between font-semibold text-brand-900">
            {group.name}
            {group.is_required && <span className="text-xs font-normal text-tomato-600">Obrigatório</span>}
          </legend>
          <div className="space-y-2">
            {group.options.map((option) => {
              const checked = (selected[group.id] ?? []).includes(option.id);
              return (
                <label
                  key={option.id}
                  className="flex cursor-pointer items-center justify-between rounded-xl border border-stone-200 px-3 py-2.5 transition-colors has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50"
                >
                  <span className="flex items-center gap-2">
                    <input
                      type={group.selection_type === "single" ? "radio" : "checkbox"}
                      name={group.id}
                      checked={checked}
                      onChange={() => toggleOption(group.id, option.id, group.selection_type, group.max_select)}
                      className="h-4 w-4 text-brand-600"
                    />
                    {option.name}
                  </span>
                  {option.price_delta !== 0 && (
                    <span className="text-sm text-stone-500">
                      {option.price_delta > 0 ? "+ " : "- "}
                      {formatCurrency(Math.abs(option.price_delta))}
                    </span>
                  )}
                </label>
              );
            })}
          </div>
        </fieldset>
      ))}

      <FieldGroup>
        <Label htmlFor="notes">Alguma observação?</Label>
        <Textarea
          id="notes"
          placeholder="Ex.: sem cebola, ponto da carne, etc."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </FieldGroup>

      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}

      {/* Quantidade + Adicionar: agora no fluxo normal (não flutuante), */}
      {/* pra não serem cobertos pela barra do carrinho. */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-3 rounded-lg border border-stone-300 bg-white px-2 py-1.5">
            <button
              type="button"
              aria-label="Diminuir quantidade"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              className="flex h-8 w-8 items-center justify-center rounded text-stone-600 hover:bg-stone-100"
            >
              <Minus className="h-4 w-4" />
            </button>
            <span className="w-6 text-center font-medium" aria-live="polite">
              {quantity}
            </span>
            <button
              type="button"
              aria-label="Aumentar quantidade"
              onClick={() => setQuantity((q) => q + 1)}
              className="flex h-8 w-8 items-center justify-center rounded text-stone-600 hover:bg-stone-100"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
          <Button className="flex-1" size="lg" onClick={handleAdicionar} disabled={!product.is_available}>
            {product.is_available
              ? `Adicionar ao pedido — ${formatCurrency(total)}`
              : "Produto esgotado"}
          </Button>
        </div>

        {/* Versão inline do "Ver carrinho" — visível, mas discreta e fora do caminho do CTA. */}
        <CarrinhoInline />
      </div>

      {/* Cards de categoria (mesmo padrão visual da home) — carrossel horizontal. */}
      <section aria-labelledby="outras-categorias" className="space-y-2 pt-2">
        <h2 id="outras-categorias" className="text-sm font-semibold text-brand-900">
          Explore outras categorias
        </h2>
        <AbasCategorias
          categorias={categorias}
          categoriaAtual={product.category.slug}
        />
      </section>
    </div>
  );
}
