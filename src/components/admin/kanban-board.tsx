"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { updateOrderStatus } from "@/lib/actions/admin-orders";
import { KanbanCard } from "@/components/admin/kanban-card";
import { cn } from "@/lib/utils";
import type { OrderItem, OrderStatus } from "@/types/database";

export type KanbanOrder = {
  id: string;
  order_number: string;
  created_at: string;
  customer_name: string;
  neighborhood_name: string | null;
  fulfillment: "delivery" | "pickup";
  payment_method: "pix" | "cash" | "card";
  payment_status: "pending" | "confirmed" | "failed";
  total: number;
  status: OrderStatus;
  items_summary: string;
};

type OrderRow = {
  id: string;
  order_number: string;
  created_at: string;
  customer_name: string;
  neighborhood_name: string | null;
  fulfillment: "delivery" | "pickup";
  payment_method: "pix" | "cash" | "card";
  payment_status: "pending" | "confirmed" | "failed";
  total: number;
  status: OrderStatus;
  order_items: Pick<OrderItem, "id" | "quantity" | "product_name">[] | null;
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
  return {
    id: row.id,
    order_number: row.order_number,
    created_at: row.created_at,
    customer_name: row.customer_name,
    neighborhood_name: row.neighborhood_name,
    fulfillment: row.fulfillment,
    payment_method: row.payment_method,
    payment_status: row.payment_status,
    total: row.total,
    status: row.status,
    items_summary: summarizeItems(row.order_items),
  };
}

export function KanbanBoard({ initialOrders }: { initialOrders: KanbanOrder[] }) {
  const [orders, setOrders] = useState<KanbanOrder[]>(initialOrders);
  const [highlight, setHighlight] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // Realtime direto no state: INSERT adiciona pedido novo (com order_items via fetch),
  // UPDATE substitui o pedido correspondente sem router.refresh().
  useEffect(() => {
    const supabase = createClient();

    async function fetchFullOrder(id: string): Promise<OrderRow | null> {
      const { data, error } = await supabase
        .from("orders")
        .select(
          "id, order_number, created_at, customer_name, neighborhood_name, fulfillment, payment_method, payment_status, total, status, order_items(id, quantity, product_name)",
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
  }, []);

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

  function ordersIn(col: Column): KanbanOrder[] {
    return orders
      .filter((o) => col.statuses.includes(o.status))
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  }

  return (
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
  );
}
