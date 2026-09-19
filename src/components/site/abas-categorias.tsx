"use client";

import Link from "next/link";
import {
  ICONES_POR_CATEGORIA,
  ICONE_CATEGORIA_PADRAO,
} from "@/lib/categoria-icones";
import type { Category } from "@/types/database";

// Mesma paleta da home (page.tsx) — alterna por índice, dando identidade
// visual diferente pra cada categoria sem depender de dado novo no banco.
const CORES_ICONE_CATEGORIA = [
  "from-brand-500 to-brand-700",
  "from-tomato-500 to-tomato-600",
  "from-accent-500 to-accent-600",
  "from-whatsapp-500 to-whatsapp-600",
];

/**
 * Carrossel horizontal de categorias no padrão visual dos cards da home.
 * Cada item é um card branco com círculo gradiente colorido + ícone + nome.
 * Click → /cardapio#<slug> (scroll-smooth no /cardápio cuida da descida).
 */
export function AbasCategorias({
  categorias,
  categoriaAtual,
}: {
  categorias: Category[];
  categoriaAtual?: string;
}) {
  if (categorias.length === 0) return null;
  return (
    <div
      className="flex snap-x gap-3 overflow-x-auto pb-2 [scrollbar-width:thin]"
      role="list"
    >
      {categorias.map((cat, i) => {
        const Icone = ICONES_POR_CATEGORIA[cat.slug] ?? ICONE_CATEGORIA_PADRAO;
        const cor = CORES_ICONE_CATEGORIA[i % CORES_ICONE_CATEGORIA.length];
        const ativo = cat.slug === categoriaAtual;
        return (
          <Link
            key={cat.id}
            href={`/cardapio#${cat.slug}`}
            role="listitem"
            aria-current={ativo ? "page" : undefined}
            className={
              "flex min-w-[104px] shrink-0 snap-start flex-col items-center gap-2 rounded-2xl border bg-white p-3 text-center shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98] " +
              (ativo
                ? "border-brand-600 ring-2 ring-brand-500/30"
                : "border-brand-900/10")
            }
          >
            <span
              className={`flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br ${cor} text-white shadow-sm`}
            >
              <Icone className="h-6 w-6" aria-hidden />
            </span>
            <span className="text-xs font-semibold text-stone-700">
              {cat.name}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
