"use client";

import { useState, useTransition } from "react";
import { updatePublicPaymentStatus } from "@/lib/actions/pedido";
import { formatCurrency } from "@/lib/utils";

export function PixPayment({
  token,
  pixKey,
  pixKeyType,
  total,
  paymentStatus,
}: {
  token: string;
  pixKey: string;
  pixKeyType: string | null;
  total: number;
  paymentStatus: "pending" | "confirmed" | "failed";
}) {
  const [copied, setCopied] = useState(false);
  const [status, setStatus] = useState(paymentStatus);
  const [isPending, startTransition] = useTransition();

  async function copyPixKey() {
    await navigator.clipboard.writeText(pixKey);
    setCopied(true);

    setTimeout(() => {
      setCopied(false);
    }, 2000);
  }

  function confirmPayment() {
    startTransition(async () => {
      const result = await updatePublicPaymentStatus(token, "pending");

      if (result.ok) {
        setStatus("pending");
      }
    });
  }

  if (status === "confirmed") {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 p-4">
        <p className="font-semibold text-green-800">
          ✓ Pagamento Pix confirmado
        </p>
        <p className="mt-1 text-sm text-green-700">
          Seu pagamento foi confirmado pela loja.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-brand-200 bg-brand-50 p-4">
      <h2 className="font-bold text-brand-900">Pagamento via Pix</h2>

      <div className="mt-3 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-stone-600">Valor</span>
          <strong className="text-brand-900">
            {formatCurrency(total)}
          </strong>
        </div>

        <div>
          <p className="text-sm text-stone-600">
            {pixKeyType ? `Chave Pix (${pixKeyType})` : "Chave Pix"}
          </p>

          <div className="mt-1 break-all rounded-lg border border-stone-200 bg-white p-3 text-sm font-medium">
            {pixKey}
          </div>
        </div>

        <button
          type="button"
          onClick={copyPixKey}
          className="w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white"
        >
          {copied ? "✓ Chave copiada!" : "Copiar chave Pix"}
        </button>

        {status === "pending" ? (
          <div className="rounded-lg bg-yellow-50 p-3 text-center text-sm text-yellow-800">
            🕐 Aguardando confirmação do pagamento pela loja.
          </div>
        ) : (
          <button
            type="button"
            onClick={confirmPayment}
            disabled={isPending}
            className="w-full rounded-lg border border-brand-600 px-4 py-2.5 text-sm font-semibold text-brand-700"
          >
            {isPending ? "Enviando..." : "Já fiz o Pix"}
          </button>
        )}
      </div>
    </div>
  );
}