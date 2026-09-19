"use client";

import { Download, Printer } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { ORDER_STATUS_LABELS } from "@/lib/pedido-status";
import type { OrderStatus } from "@/types/database";

export type ExportRow = {
  id: string;
  order_number: string;
  created_at: string;
  customer_name: string;
  customer_phone: string;
  payment_method: "pix" | "cash" | "card";
  status: OrderStatus;
  delivery_fee: number;
  total: number;
};

const PAYMENT_LABELS: Record<ExportRow["payment_method"], string> = {
  pix: "Pix",
  cash: "Dinheiro",
  card: "Cartão",
};

/** Escapa uma célula pra CSV: troca aspas por "" e envolve em aspas. */
function csvCell(v: string | number): string {
  const s = typeof v === "number" ? v.toString() : v;
  if (/[",;\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function buildCsv(rows: ExportRow[]): string {
  const headers = [
    "ID do Pedido",
    "Data/Hora",
    "Cliente",
    "Telefone",
    "Forma de Pagamento",
    "Status",
    "Taxa de Entrega (R$)",
    "Total do Pedido (R$)",
  ];
  const lines: string[] = [];
  lines.push(headers.map(csvCell).join(";"));
  for (const r of rows) {
    const dt = new Date(r.created_at).toLocaleString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    lines.push(
      [
        r.order_number,
        dt,
        r.customer_name,
        r.customer_phone,
        PAYMENT_LABELS[r.payment_method] ?? r.payment_method,
        ORDER_STATUS_LABELS[r.status] ?? r.status,
        r.delivery_fee.toFixed(2).replace(".", ","),
        r.total.toFixed(2).replace(".", ","),
      ]
        .map(csvCell)
        .join(";"),
    );
  }
  // BOM + CRLF pra Excel abrir com acentos certos no Windows.
  return "﻿" + lines.join("\r\n");
}

function buildFilename(): string {
  const today = new Date().toLocaleDateString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  // "13/09/2026" -> "13-09-2026" pra filename seguro.
  const safe = today.replace(/\//g, "-");
  return `relatorio-vendas-mendes-${safe}.csv`;
}

export function ExportActions({ rows }: { rows: ExportRow[] }) {
  function handleCsv() {
    const csv = buildCsv(rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = buildFilename();
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function handlePrint() {
    window.print();
  }

  return (
    <div className="no-print flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={handleCsv}
        disabled={rows.length === 0}
        className="inline-flex items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-50 active:scale-95 disabled:opacity-50"
        title="Exportar últimos 7 dias em CSV"
      >
        <Download className="h-4 w-4" aria-hidden />
        Exportar CSV
      </button>
      <button
        type="button"
        onClick={handlePrint}
        disabled={rows.length === 0}
        className="inline-flex items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-50 active:scale-95 disabled:opacity-50"
        title="Imprimir ou salvar como PDF"
      >
        <Printer className="h-4 w-4" aria-hidden />
        Imprimir / PDF
      </button>
    </div>
  );
}

/** Helper de formatação reusado dentro do print header. */
export function formatReportHeaderDate(): string {
  return new Date().toLocaleDateString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Header do relatório impresso (oculto em tela, visível em @media print). */
export function PrintHeader({
  businessName,
  revenue7d,
  ordersCount7d,
  feesEconomy,
}: {
  businessName: string;
  revenue7d: number;
  ordersCount7d: number;
  feesEconomy: number;
}) {
  return (
    <div className="print-only mb-4 hidden border-b border-stone-300 pb-3 print:block">
      <h1 className="text-xl font-bold text-stone-900">
        Relatório de Vendas — {businessName}
      </h1>
      <p className="text-sm text-stone-600">
        Emitido em {formatReportHeaderDate()}
      </p>
      <div className="mt-2 grid grid-cols-3 gap-3 text-sm">
        <div>
          <p className="text-stone-500">Faturamento 7 dias</p>
          <p className="font-bold text-stone-900">{formatCurrency(revenue7d)}</p>
        </div>
        <div>
          <p className="text-stone-500">Total de pedidos</p>
          <p className="font-bold text-stone-900">{ordersCount7d}</p>
        </div>
        <div>
          <p className="text-stone-500">Economia em taxas (20%)</p>
          <p className="font-bold text-emerald-700">
            {formatCurrency(feesEconomy)}
          </p>
        </div>
      </div>
    </div>
  );
}
