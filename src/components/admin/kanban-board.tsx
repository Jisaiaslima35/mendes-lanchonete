"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { Bell, BellOff } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { updateOrderStatus, updatePaymentStatus } from "@/lib/actions/admin-orders";
import { KanbanCard } from "@/components/admin/kanban-card";
import { cn } from "@/lib/utils";
import { playOrderAlert, useOrderAlertSound } from "@/lib/sound";
import type { OrderItem, OrderStatus } from "@/types/database";

export type KanbanOrderItem = {
  id: string;
  quantity: number;
  product_name: string;
  notes: string | null;
};

export type KanbanOrder = {
  id: string;
  order_number: string;
  created_at: string;
  customer_name: string;
  neighborhood_name: string | null;
  fulfillment: "delivery" | "pickup" | "mesa";
  mesa: string | null;
  payment_method: "pix" | "cash" | "card";
  payment_status: "pending" | "confirmed" | "failed";
  /**
   * Valor da nota que o cliente vai pagar em dinheiro (null em pix/card).
   * Lote 2 item 2: destaque visual no Kanban + propagação pro n8n.
   */
  change_for: number | null;
  /**
   * Lote 1 item 4 (migration 2026-09-18): identifica se o Pix é dinâmico (MP)
   * ou manual (BR Code local). null em cash/card.
   */
  payment_provider: "mercadopago" | "manual" | null;
  total: number;
  status: OrderStatus;
  notes: string | null;
  items: KanbanOrderItem[];
  items_summary: string;
};

type OrderRow = {
  id: string;
  order_number: string;
  created_at: string;
  customer_name: string;
  neighborhood_name: string | null;
  fulfillment: "delivery" | "pickup" | "mesa";
  mesa: string | null;
  payment_method: "pix" | "cash" | "card";
  payment_status: "pending" | "confirmed" | "failed";
  payment_provider: "mercadopago" | "manual" | null;
  change_for: number | null;
  total: number;
  status: OrderStatus;
  notes: string | null;
  order_items: Pick<OrderItem, "id" | "quantity" | "product_name" | "notes">[] | null;
};

type Column = {
  id: string;
  title: string;
  statuses: OrderStatus[];
  accent: string;
};

const COLUMNS: Column[] = [
  {
    id: "novos",
    title: "Novos / Confirmados",
    statuses: ["novo", "confirmado"],
    accent: "bg-amber-100 text-amber-900 border-amber-200",
  },
  {
    id: "preparo",
    title: "Em Preparo",
    statuses: ["em_preparo", "pronto"],
    accent: "bg-orange-100 text-orange-900 border-orange-200",
  },
  {
    id: "entrega",
    title: "Saiu p/ Entrega",
    statuses: ["saiu_entrega"],
    accent: "bg-sky-100 text-sky-900 border-sky-200",
  },
  {
    id: "concluidos",
    title: "Concluídos",
    statuses: ["entregue"],
    accent: "bg-emerald-100 text-emerald-900 border-emerald-200",
  },
];

const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  novo: "em_preparo",
  confirmado: "em_preparo",
  em_preparo: "saiu_entrega",
  pronto: "saiu_entrega",
  saiu_entrega: "entregue",
};

function summarizeItems(
  items: Pick<OrderItem, "quantity" | "product_name">[] | null | undefined,
): string {
  return (items ?? [])
    .map((it) => `${it.quantity}x ${it.product_name}`)
    .join(" · ");
}

function rowToKanban(row: OrderRow): KanbanOrder {
  const items = (row.order_items ?? []).map((it) => ({
    id: it.id,
    quantity: it.quantity,
    product_name: it.product_name,
    notes: it.notes ?? null,
  }));
  return {
    id: row.id,
    order_number: row.order_number,
    created_at: row.created_at,
    customer_name: row.customer_name,
    neighborhood_name: row.neighborhood_name,
    fulfillment: row.fulfillment,
    mesa: row.mesa,
    payment_method: row.payment_method,
    payment_status: row.payment_status,
    payment_provider: row.payment_provider ?? null,
    change_for: row.change_for ?? null,
    total: row.total,
    status: row.status,
    notes: row.notes ?? null,
    items,
    items_summary: summarizeItems(row.order_items),
  };
}

export function KanbanBoard({ initialOrders }: { initialOrders: KanbanOrder[] }) {
  const [orders, setOrders] = useState<KanbanOrder[]>(initialOrders);
  const [highlight, setHighlight] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  // Lote 2 item 1: alerta sonoro via Web Audio API. Toggle persistente em
  // localStorage; AudioContext só é criado/resumido DEPOIS do primeiro clique
  // (política de autoplay do browser).
  const { enabled: soundEnabled, enable: enableSound, disable: disableSound, ctxRef } =
    useOrderAlertSound();

  // Realtime direto no state: INSERT adiciona pedido novo (com order_items via fetch),
  // UPDATE substitui o pedido correspondente sem router.refresh().
  useEffect(() => {
    const supabase = createClient();

    async function fetchFullOrder(id: string): Promise<OrderRow | null> {
      const { data, error } = await supabase
        .from("orders")
        .select(
          "id, order_number, created_at, customer_name, neighborhood_name, fulfillment, mesa, payment_method, payment_status, payment_provider, change_for, total, status, notes, order_items(id, quantity, product_name, notes)",
        )
        .eq("id", id)
        .maybeSingle();
      if (error) {
        console.warn("[kanban] fetch order falhou", { id, error });
        return null;
      }
      return (data as unknown as OrderRow) ?? null;
    }

    const channel = supabase
      .channel("admin-orders-kanban")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "orders" },
        async (payload) => {
          const newId = payload.new.id as string;
          const row = await fetchFullOrder(newId);
          if (!row) return;
          const order = rowToKanban(row);
          setOrders((prev) => {
            if (prev.some((o) => o.id === order.id)) return prev;
            return [order, ...prev];
          });
          setHighlight(order.id);
          setTimeout(() => setHighlight(null), 2500);
          // Toca beep — só se o atendente ativou o alerta e o status inicial
          // é "novo" (pendente de preparo). Pedidos que entram já com status
          // confirmado/atendido (raro mas possível via webhook) não disparam.
          if (soundEnabled && order.status === "novo") {
            playOrderAlert(ctxRef.current);
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders" },
        (payload) => {
          const updated = payload.new as Partial<OrderRow> & { id: string };
          setOrders((prev) =>
            prev.map((o) =>
              o.id === updated.id
                ? {
                    ...o,
                    status: (updated.status as OrderStatus) ?? o.status,
                    payment_status:
                      (updated.payment_status as KanbanOrder["payment_status"]) ??
                      o.payment_status,
                    payment_provider:
                      (updated.payment_provider as KanbanOrder["payment_provider"]) ??
                      o.payment_provider,
                  }
                : o,
            ),
          );
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [soundEnabled, ctxRef]);

  // Optimistic advance: muda o status no state imediatamente, depois chama
  // a action. Em caso de erro, reverte pro status original.
  const handleAdvance = useCallback(
    (orderId: string, next: OrderStatus) => {
      let previousStatus: OrderStatus | null = null;
      setOrders((prev) =>
        prev.map((o) => {
          if (o.id !== orderId) return o;
          previousStatus = o.status;
          return { ...o, status: next };
        }),
      );

      startTransition(async () => {
        const result = await updateOrderStatus(orderId, next);
        if (!result.ok && previousStatus) {
          // Rollback
          setOrders((prev) =>
            prev.map((o) =>
              o.id === orderId ? { ...o, status: previousStatus as OrderStatus } : o,
            ),
          );
          console.error("[kanban] advance falhou", { orderId, error: result.error });
        }
      });
    },
    [],
  );

  // Confirmar Pix Manual — atualiza payment_status do pedido pra "confirmed"
  // após o admin cruzar o comprovante no WhatsApp. Otimista: muda local primeiro.
  const handleConfirmPix = useCallback((orderId: string) => {
    setOrders((prev) =>
      prev.map((o) =>
        o.id === orderId ? { ...o, payment_status: "confirmed" as const } : o,
      ),
    );

    startTransition(async () => {
      const result = await updatePaymentStatus(orderId, "confirmed");
      if (!result.ok) {
        // Rollback
        setOrders((prev) =>
          prev.map((o) =>
            o.id === orderId ? { ...o, payment_status: "pending" as const } : o,
          ),
        );
        console.error("[kanban] confirm pix falhou", { orderId, error: result.error });
      }
    });
  }, []);

  function ordersIn(col: Column): KanbanOrder[] {
    return orders
      .filter((o) => col.statuses.includes(o.status))
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-end">
        <button
          type="button"
          onClick={soundEnabled ? disableSound : enableSound}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition",
            soundEnabled
              ? "border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
              : "border-stone-200 bg-white text-stone-600 hover:bg-stone-50",
          )}
          title={
            soundEnabled
              ? "Alerta sonoro ativado — clique pra desligar"
              : "Clique pra ativar o alerta sonoro de pedido novo"
          }
          aria-pressed={soundEnabled}
        >
          {soundEnabled ? (
            <>
              <Bell className="h-3.5 w-3.5" aria-hidden />
              Alerta sonoro ON
            </>
          ) : (
            <>
              <BellOff className="h-3.5 w-3.5" aria-hidden />
              Ativar alerta sonoro
            </>
          )}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      {COLUMNS.map((col) => {
        const items = ordersIn(col);
        return (
          <div
            key={col.id}
            className="flex min-h-[60vh] flex-col rounded-xl border border-stone-200 bg-stone-50/60 p-3"
          >
            <div
              className={cn(
                "mb-3 flex items-center justify-between rounded-lg border px-3 py-2",
                col.accent,
              )}
            >
              <h2 className="text-sm font-bold">{col.title}</h2>
              <span className="rounded-full bg-white/70 px-2 py-0.5 text-xs font-bold">
                {items.length}
              </span>
            </div>

            <div className="flex-1 space-y-2 overflow-y-auto">
              {items.length === 0 ? (
                <p className="rounded-lg border border-dashed border-stone-200 bg-white/40 py-6 text-center text-xs text-stone-400">
                  vazio
                </p>
              ) : (
                items.map((order) => {
                  const next = NEXT_STATUS[order.status];
                  return (
                    <div
                      key={order.id}
                      className={cn(
                        "transition",
                        highlight === order.id &&
                          "ring-2 ring-emerald-400 ring-offset-2 ring-offset-stone-50 rounded-xl",
                      )}
                    >
                      <KanbanCard
                        order={order}
                        nextStatus={next ?? null}
                        onAdvance={() => next && handleAdvance(order.id, next)}
                        onConfirmPix={() => handleConfirmPix(order.id)}
                      />
                    </div>
                  );
                })
              )}
            </div>
          </div>
        );
      })}
      </div>
    </div>
  );
}
