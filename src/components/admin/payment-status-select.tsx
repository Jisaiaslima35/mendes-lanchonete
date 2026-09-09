"use client";

import { useState, useTransition } from "react";
import { updatePaymentStatus } from "@/lib/actions/admin-orders";
import { Select } from "@/components/ui/field";

type PaymentStatus = "pending" | "confirmed" | "failed";

const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  pending: "Aguardando pagamento",
  confirmed: "Pagamento confirmado",
  failed: "Pagamento não confirmado",
};

export function PaymentStatusSelect({
  orderId,
  status,
}: {
  orderId: string;
  status: PaymentStatus;
}) {
  const [current, setCurrent] = useState<PaymentStatus>(status);
  const [isPending, startTransition] = useTransition();

  function handleChange(value: string) {
    const previous = current;
    const next = value as PaymentStatus;

    setCurrent(next);

    startTransition(async () => {
      const result = await updatePaymentStatus(orderId, next);

      if (!result.ok) {
        setCurrent(previous);
      }
    });
  }

  return (
    <Select
      aria-label="Status do pagamento"
      value={current}
      disabled={isPending}
      onChange={(e) => handleChange(e.target.value)}
      className="h-9 text-sm"
    >
      {Object.entries(PAYMENT_STATUS_LABELS).map(([value, label]) => (
        <option key={value} value={value}>
          {label}
        </option>
      ))}
    </Select>
  );
}