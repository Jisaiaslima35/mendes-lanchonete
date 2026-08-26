"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { itemsSubtotal, lineTotal, type PricedCartItem } from "@/lib/precos";
import type { CarrinhoItem, NovoItemCarrinho } from "./tipos";

const STORAGE_KEY = "mendes:carrinho:v1";

function buildLineId(item: NovoItemCarrinho) {
  const optionsKey = item.options
    .map((o) => o.id)
    .sort()
    .join(",");
  return `${item.productId}::${optionsKey}::${item.notes ?? ""}`;
}

function toPriced(item: CarrinhoItem): PricedCartItem {
  return {
    productId: item.productId,
    productName: item.productName,
    unitPrice: item.unitPrice,
    quantity: item.quantity,
    notes: item.notes,
    options: item.options.map((o) => ({
      id: o.id,
      groupName: o.groupName,
      optionName: o.optionName,
      priceDelta: o.priceDelta,
    })),
  };
}

type CarrinhoContextValue = {
  itens: CarrinhoItem[];
  totalItens: number;
  subtotal: number;
  isHidratado: boolean;
  adicionarItem: (item: NovoItemCarrinho) => void;
  removerItem: (lineId: string) => void;
  alterarQuantidade: (lineId: string, quantity: number) => void;
  atualizarObservacao: (lineId: string, notes: string) => void;
  limparCarrinho: () => void;
  totalDaLinha: (item: CarrinhoItem) => number;
};

const CarrinhoContext = createContext<CarrinhoContextValue | null>(null);

const semInscricao = () => () => {};

/** true somente após a hidratação no cliente — evita mismatch de SSR sem setState em efeito. */
function useIsHidratado() {
  return useSyncExternalStore(semInscricao, () => true, () => false);
}

export function CarrinhoProvider({ children }: { children: ReactNode }) {
  // Começa vazio (igual ao servidor) e só lê o localStorage após a hidratação,
  // senão o HTML do cliente diverge do SSR (localStorage não existe no servidor).
  const [itens, setItens] = useState<CarrinhoItem[]>([]);
  const isHidratado = useIsHidratado();
  const carregouRef = useRef(false);

  useEffect(() => {
    if (!isHidratado) return;

    if (!carregouRef.current) {
      carregouRef.current = true;
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        // eslint-disable-next-line react-hooks/set-state-in-effect -- leitura do carrinho persistido só pode ocorrer no cliente, após a hidratação; dispara o único re-render necessário para exibir o carrinho salvo.
        if (raw) setItens(JSON.parse(raw));
      } catch {
        // localStorage indisponível ou dados corrompidos — segue com carrinho vazio.
      }
      // Não grava aqui: `itens` ainda reflete o valor anterior a este carregamento
      // (o setItens acima só se aplica no próximo render) — gravar agora sobrescreveria
      // o localStorage com "[]" antes de o carrinho recém-lido ser exibido.
      return;
    }

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(itens));
  }, [itens, isHidratado]);

  const adicionarItem = useCallback((novoItem: NovoItemCarrinho) => {
    const lineId = buildLineId(novoItem);
    setItens((prev) => {
      const existente = prev.find((i) => i.lineId === lineId);
      if (existente) {
        return prev.map((i) =>
          i.lineId === lineId ? { ...i, quantity: i.quantity + novoItem.quantity } : i,
        );
      }
      return [...prev, { ...novoItem, lineId }];
    });
  }, []);

  const removerItem = useCallback((lineId: string) => {
    setItens((prev) => prev.filter((i) => i.lineId !== lineId));
  }, []);

  const alterarQuantidade = useCallback((lineId: string, quantity: number) => {
    setItens((prev) => {
      if (quantity <= 0) return prev.filter((i) => i.lineId !== lineId);
      return prev.map((i) => (i.lineId === lineId ? { ...i, quantity } : i));
    });
  }, []);

  const atualizarObservacao = useCallback((lineId: string, notes: string) => {
    setItens((prev) => prev.map((i) => (i.lineId === lineId ? { ...i, notes } : i)));
  }, []);

  const limparCarrinho = useCallback(() => setItens([]), []);

  const totalDaLinha = useCallback((item: CarrinhoItem) => lineTotal(toPriced(item)), []);

  const subtotal = useMemo(() => itemsSubtotal(itens.map(toPriced)), [itens]);
  const totalItens = useMemo(() => itens.reduce((sum, i) => sum + i.quantity, 0), [itens]);

  const value = useMemo(
    () => ({
      itens,
      totalItens,
      subtotal,
      isHidratado,
      adicionarItem,
      removerItem,
      alterarQuantidade,
      atualizarObservacao,
      limparCarrinho,
      totalDaLinha,
    }),
    [
      itens,
      totalItens,
      subtotal,
      isHidratado,
      adicionarItem,
      removerItem,
      alterarQuantidade,
      atualizarObservacao,
      limparCarrinho,
      totalDaLinha,
    ],
  );

  return <CarrinhoContext.Provider value={value}>{children}</CarrinhoContext.Provider>;
}

export function useCarrinho() {
  const ctx = useContext(CarrinhoContext);
  if (!ctx) throw new Error("useCarrinho deve ser usado dentro de CarrinhoProvider.");
  return ctx;
}

export { toPriced as itemCarrinhoParaPrecificacao };
