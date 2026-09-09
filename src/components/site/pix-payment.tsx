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
  pixQrCode,
  pixQrCodeBase64,
  pixTicketUrl,
}: {
  token: string;
  pixKey: string;
  pixKeyType: string | null;
  total: number;
  paymentStatus: "pending" | "confirmed" | "failed";
  pixQrCode?: string | null;
  pixQrCodeBase64?: string | null;
  pixTicketUrl?: string | null;
}) {
  const [copied, setCopied] = useState(false);
  const [status, setStatus] = useState(paymentStatus);
  const [isPending, startTransition] = useTransition();

  async function copyPixCode() {
    if (!pixQrCode) return;

    await navigator.clipboard.writeText(pixQrCode);
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
          Seu pagamento foi confirmado.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-brand-200 bg-brand-50 p-4">
      <h2 className="font-bold text-brand-900">
        Pagamento via Pix
      </h2>

      <div className="mt-3 space-y-4">

        <div className="flex justify-between text-sm">
          <span className="text-stone-600">Valor</span>

          <strong className="text-brand-900">
            {formatCurrency(total)}
          </strong>
        </div>

        {pixQrCodeBase64 && (
          <div className="rounded-xl border border-stone-200 bg-white p-4">
            <p className="mb-3 text-center text-sm font-semibold text-stone-700">
              Escaneie o QR Code para pagar
            </p>

            <img
              src={`data:image/png;base64,${pixQrCodeBase64}`}
              alt="QR Code para pagamento Pix"
              className="mx-auto h-56 w-56 rounded-lg border bg-white p-2"
            />

            <p className="mt-3 text-center text-xs text-stone-500">
              Abra o aplicativo do seu banco e escaneie o código.
            </p>
          </div>
        )}

        {pixQrCode && (
          <div>
            <p className="text-sm font-semibold text-stone-700">
              Pix Copia e Cola
            </p>

            <div className="mt-1 break-all rounded-lg border border-stone-200 bg-white p-3 text-xs text-stone-600">
              {pixQrCode}
            </div>

            <button
              type="button"
              onClick={copyPixCode}
              className="mt-2 w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white"
            >
              {copied
                ? "✓ Pix Copia e Cola copiado!"
                : "Copiar Pix Copia e Cola"}
            </button>
          </div>
        )}

        {pixTicketUrl && (
          <a
            href={pixTicketUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full rounded-lg border border-brand-600 bg-white px-4 py-2.5 text-center text-sm font-semibold text-brand-700"
          >
            Abrir pagamento Pix
          </a>
        )}

        {!pixQrCode && !pixQrCodeBase64 && (
          <div>
            <p className="text-sm text-stone-600">
              {pixKeyType
                ? `Chave Pix (${pixKeyType})`
                : "Chave Pix"}
            </p>

            <div className="mt-1 break-all rounded-lg border border-stone-200 bg-white p-3 text-sm font-medium">
              {pixKey}
            </div>

            <button
              type="button"
              onClick={async () => {
                await navigator.clipboard.writeText(pixKey);
                setCopied(true);

                setTimeout(() => {
                  setCopied(false);
                }, 2000);
              }}
              className="mt-2 w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white"
            >
              {copied ? "✓ Chave copiada!" : "Copiar chave Pix"}
            </button>
          </div>
        )}

        {status === "pending" ? (
          <div className="rounded-lg bg-yellow-50 p-3 text-center text-sm text-yellow-800">
            🕐 Aguardando confirmação do pagamento.
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