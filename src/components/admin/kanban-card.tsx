"use client";

import { useState, useTransition } from "react";
import { Clock, MapPin, ChevronRight } from "lucide-react";
import { formatCurrency, formatWhenShort, cn } from "@/lib/utils";
import type { OrderStatus } from "@/types/database";
import type { KanbanOrder } from "@/components/admin/kanban-board";

const PAY_BADGE = {
  pix: { label: "Pix", tone: "bg-emerald-100 text-emerald-800" },
  cash: { label: "Dinheiro", tone: "bg-amber-100 text-amber-800" },
  card: { label: "Cartão", tone: "bg-sky-100 text-sky-800" },
} as const;

const MODALITY_BADGE = {
  delivery: { label: "ENTREGA", emoji: "🛵", tone: "bg-sky-100 text-sky-900 border-sky-200" },
  pickup: { label: "BALCÃO", emoji: "🛍", tone: "bg-amber-100 text-amber-900 border-amber-200" },
  mesa: { label: "MESA", emoji: "🍽", tone: "bg-emerald-100 text-emerald-900 border-emerald-200" },
} as const;

export function KanbanCard({
  order,
  nextStatus,
  onAdvance,
  onConfirmPix,
}: {
  order: KanbanOrder;
  nextStatus: OrderStatus | null;
  onAdvance: () => void;
  /** Callback opcional: quando presente, mostra botão "✓ Confirmar Pix" pra
   *  pedidos Pix Manual pendentes. */
  onConfirmPix?: () => void;
}) {
  const [isPending] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const payBadge = PAY_BADGE[order.payment_method];
  const isPaidPix =
    order.payment_method === "pix" && order.payment_status === "confirmed";
  // Lote 1 item 4 (migration 2026-09-18): destaca pedidos Pix Manual pendentes.
  const isPixManualPending =
    order.payment_method === "pix" &&
    order.payment_provider === "manual" &&
    order.payment_status === "pending";

  function handleClick() {
    if (!nextStatus) return;
    setErrorMsg(null);
    onAdvance();
  }

  return (
    <div
      className={cn(
        "rounded-xl border border-stone-200 bg-white p-3 shadow-sm transition",
        isPending && "opacity-60",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-bold text-stone-900">
            #{order.order_number}
          </p>

          <p className="mt-0.5 flex items-center gap-1 text-xs text-stone-500">
            <Clock className="h-3 w-3" aria-hidden />
            <span title={new Date(order.created_at).toLocaleString("pt-BR")}>
              {formatWhenShort(order.created_at)}
            </span>
          </p>
        </div>

        <span
          className={cn(
            "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
            payBadge.tone,
          )}
          title={
            order.payment_method === "pix"
              ? isPaidPix
                ? "Pix confirmado"
                : order.payment_provider === "manual"
                  ? "Pix Manual pendente — conferir comprovante no WhatsApp"
                  : "Pix pendente"
              : `Pagamento em ${payBadge.label.toLowerCase()}`
          }
        >
          {payBadge.label}
          {order.payment_method === "pix" && (isPaidPix ? " ✅" : " ⏳")}
        </span>
      </div>

      {/*
        Badge destacado Pix Manual — aparece só quando o pedido é Pix Manual
        E ainda está pending. Após admin confirmar (botão abaixo), some.
      */}
      {isPixManualPending && (
        <div
          className="mt-2 rounded-md border border-yellow-400 bg-yellow-50 px-2 py-1.5 text-[11px] font-bold uppercase tracking-wide text-yellow-900"
          title="Confirme manualmente após cruzar o comprovante que o cliente mandou no WhatsApp"
        >
          ⚠ Pix Manual (Conferir Comprovante)
        </div>
      )}

      {/*
        Lote 2 item 2: badge de troco quando pagamento é dinheiro.
        Só aparece se change_for > total (caso contrário é pagamento exato,
        não precisa de troco). Mostra o valor que o motoboy vai levar +
        quanto vai devolver pro cliente.
      */}
      {order.payment_method === "cash" &&
        typeof order.change_for === "number" &&
        order.change_for > order.total && (
          <div
            className="mt-2 rounded-md border border-amber-300 bg-amber-50 px-2 py-1.5 text-[11px] leading-tight text-amber-900"
            title="Valor em dinheiro que o cliente vai entregar — levar troco"
          >
            <p className="font-bold uppercase tracking-wide">
              💵 Levar troco para {formatCurrency(order.change_for)}
            </p>
            <p className="mt-0.5 text-amber-800">
              Troco: <strong>{formatCurrency(order.change_for - order.total)}</strong>
            </p>
          </div>
        )}

      <div className="mt-2 space-y-1">
        <p className="truncate text-sm font-semibold text-stone-800">
          {order.customer_name}
        </p>

        <div className="flex items-center gap-1.5">
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide",
              MODALITY_BADGE[order.fulfillment].tone,
            )}
            title={
              order.fulfillment === "mesa"
                ? `Consumo na Mesa ${order.mesa ?? "?"}`
                : order.fulfillment === "delivery"
                  ? "Entrega (delivery)"
                  : "Retirada no balcão"
            }
          >
            <span aria-hidden>{MODALITY_BADGE[order.fulfillment].emoji}</span>
            <span>
              {order.fulfillment === "mesa"
                ? `MESA ${order.mesa ?? "?"}`
                : MODALITY_BADGE[order.fulfillment].label}
            </span>
          </span>
        </div>

        <p className="flex items-center gap-1 truncate text-xs text-stone-500">
          <MapPin className="h-3 w-3 shrink-0" aria-hidden />
          {order.fulfillment === "delivery"
            ? (order.neighborhood_name ?? "—")
            : order.fulfillment === "mesa"
              ? `Mesa ${order.mesa ?? "—"} (consumo no local)`
              : "Retirada no local"}
        </p>

        {order.items.length > 0 && (
          <ul className="mt-1 space-y-0.5 border-t border-stone-100 pt-1 text-[11px] text-stone-600">
            {order.items.map((it) => (
              <li key={it.id} className="leading-tight">
                <span className="font-medium">{it.quantity}x {it.product_name}</span>
                {it.notes && (
                  <span className="ml-1 italic text-amber-700">
                    (Obs: {it.notes})
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}

        {order.notes && (
          <p
            className="mt-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] italic text-amber-800"
            title="Observação geral do pedido"
          >
            📝 {order.notes}
          </p>
        )}
      </div>

      {errorMsg && (
        <p className="mt-2 rounded-md bg-rose-50 px-2 py-1 text-[11px] text-rose-700">
          {errorMsg}
        </p>
      )}

      <div className="mt-2 flex items-center justify-between border-t border-stone-100 pt-2">
        <span className="text-sm font-bold text-brand-700">
          {formatCurrency(order.total)}
        </span>

        <div className="flex items-center gap-1.5">
          {isPixManualPending && onConfirmPix && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onConfirmPix();
              }}
              className="rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-emerald-700 active:scale-95"
              title="Marcar Pix como confirmado após ver o comprovante no WhatsApp"
            >
              ✓ Confirmar Pix
            </button>
          )}

          {nextStatus ? (
            <button
              type="button"
              onClick={handleClick}
              className="inline-flex items-center gap-1 rounded-lg bg-brand-600 px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-brand-700 active:scale-95"
            >
              Avançar
              <ChevronRight className="h-3 w-3" aria-hidden />
            </button>
          ) : (
            <span className="text-xs text-stone-400">finalizado</span>
          )}
        </div>
      </div>
    </div>
  );
}
