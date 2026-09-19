"use client";

import { ORDER_STATUS_LABELS } from "@/lib/pedido-status";
import { formatCurrency } from "@/lib/utils";
import type { ExportRow } from "@/components/admin/charts/export-actions";

const PAYMENT_LABELS: Record<ExportRow["payment_method"], string> = {
  pix: "Pix",
  cash: "Dinheiro",
  card: "Cartão",
};

/** Tabela de pedidos só visível em @media print (escondida em tela). */
export function PrintOrdersTable({ rows }: { rows: ExportRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="print-only mt-4 hidden text-sm text-stone-500 print:block">
        Nenhum pedido no período selecionado.
      </p>
    );
  }
  return (
    <div className="print-only mt-4 hidden print:block">
      <h2 className="mb-2 text-sm font-semibold text-stone-900">
        Pedidos ({rows.length})
      </h2>
      <table className="w-full border-collapse text-[11px]">
        <thead>
          <tr className="border-b border-stone-400">
            <th className="py-1 text-left font-semibold text-stone-700">
              Pedido
            </th>
            <th className="py-1 text-left font-semibold text-stone-700">
              Data/Hora
            </th>
            <th className="py-1 text-left font-semibold text-stone-700">
              Cliente
            </th>
            <th className="py-1 text-left font-semibold text-stone-700">
              Telefone
            </th>
            <th className="py-1 text-left font-semibold text-stone-700">
              Pagamento
            </th>
            <th className="py-1 text-left font-semibold text-stone-700">
              Status
            </th>
            <th className="py-1 text-right font-semibold text-stone-700">
              Frete
            </th>
            <th className="py-1 text-right font-semibold text-stone-700">
              Total
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const dt = new Date(r.created_at).toLocaleString("pt-BR", {
              timeZone: "America/Sao_Paulo",
              day: "2-digit",
              month: "2-digit",
              year: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
            });
            return (
              <tr key={r.id} className="border-b border-stone-200">
                <td className="py-1 font-medium">{r.order_number}</td>
                <td className="py-1">{dt}</td>
                <td className="py-1">{r.customer_name}</td>
                <td className="py-1">{r.customer_phone}</td>
                <td className="py-1">
                  {PAYMENT_LABELS[r.payment_method] ?? r.payment_method}
                </td>
                <td className="py-1">
                  {ORDER_STATUS_LABELS[r.status] ?? r.status}
                </td>
                <td className="py-1 text-right">
                  {formatCurrency(r.delivery_fee)}
                </td>
                <td className="py-1 text-right font-bold">
                  {formatCurrency(r.total)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
