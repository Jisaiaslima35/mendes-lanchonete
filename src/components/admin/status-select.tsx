"use client";

import { useState, useTransition } from "react";
import { updateOrderStatus } from "@/lib/actions/admin-orders";
import { ORDER_STATUS_LABELS, ORDER_STATUS_ORDER } from "@/lib/pedido-status";
import { Select } from "@/components/ui/field";
import type { OrderStatus } from "@/types/database";

export function StatusSelect({ orderId, status }: { orderId: string; status: OrderStatus }) {
  const [current, setCurrent] = useState(status);
  const [isPending, startTransition] = useTransition();

  function handleChange(value: string) {
    const previous = current;
    setCurrent(value as OrderStatus);
    startTransition(async () => {
      const result = await updateOrderStatus(orderId, value);
      if (!result.ok) setCurrent(previous);
    });
  }

  return (
    <Select
      aria-label="Status do pedido"
      value={current}
      disabled={isPending}
      onChange={(e) => handleChange(e.target.value)}
      className="h-9 text-sm"
    >
      {ORDER_STATUS_ORDER.map((s) => (
        <option key={s} value={s}>
          {ORDER_STATUS_LABELS[s]}
        </option>
      ))}
    </Select>
  );
}
