"use client";

import { useState, useTransition } from "react";
import { Clock, MapPin, ChevronRight } from "lucide-react";
import { formatCurrency, formatTime, cn } from "@/lib/utils";
import type { OrderStatus } from "@/types/database";
import type { KanbanOrder } from "@/components/admin/kanban-board";

const PAY_BADGE = {
  pix: { label: "Pix", tone: "bg-emerald-100 text-emerald-800" },
  cash: { label: "Dinheiro", tone: "bg-amber-100 text-amber-800" },
  card: { label: "Cartão", tone: "bg-sky-100 text-sky-800" },
} as const;

export function KanbanCard({
  order,
  nextStatus,
  onAdvance,
}: {
  order: KanbanOrder;
  nextStatus: OrderStatus | null;
  onAdvance: () => void;
}) {
  const [isPending] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const payBadge = PAY_BADGE[order.payment_method];
  const isPaidPix =
    order.payment_method === "pix" && order.payment_status === "confirmed";

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
            {formatTime(order.created_at)}
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
                : "Pix pendente"
              : `Pagamento em ${payBadge.label.toLowerCase()}`
          }
        >
          {payBadge.label}
          {order.payment_method === "pix" && (isPaidPix ? " ✅" : " ⏳")}
        </span>
      </div>

      <div className="mt-2 space-y-1">
        <p className="truncate text-sm font-semibold text-stone-800">
          {order.customer_name}
        </p>

        <p className="flex items-center gap-1 truncate text-xs text-stone-500">
          <MapPin className="h-3 w-3 shrink-0" aria-hidden />
          {order.fulfillment === "delivery"
            ? (order.neighborhood_name ?? "—")
            : "Retirada no local"}
        </p>

        <p className="line-clamp-2 text-xs text-stone-600">
          {order.items_summary}
        </p>
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
  );
}
