"use client";

import { cn, formatCurrency } from "@/lib/utils";

// ====================================================================
// Tipos puros — props serializadas do server pro client.
// ====================================================================

export type DailyRevenuePoint = {
  /** ISO date (YYYY-MM-DD) no fuso America/Sao_Paulo. */
  dia: string;
  /** Dia da semana 0..6 (Sunday..Saturday), vindo do Postgres. */
  dow: number;
  /** Total faturado no dia (R$). */
  total: number;
};

export type PaymentSlice = {
  payment_method: "pix" | "cash" | "card";
  orders_count: number;
  revenue: number;
};

const PAYMENT_META: Record<
  PaymentSlice["payment_method"],
  { label: string; tone: string; rgb: string }
> = {
  pix: { label: "Pix", tone: "bg-emerald-500", rgb: "16,185,129" },
  cash: { label: "Dinheiro", tone: "bg-amber-500", rgb: "245,158,11" },
  card: { label: "Cartão", tone: "bg-sky-500", rgb: "14,165,233" },
};

const DOW_SHORT_PT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

// ====================================================================
// Gráfico de Barras (vendas por dia da semana)
// SVG nativo — sem libs externas. 7 colunas, eixo Y automático.
// ====================================================================

export function DailyRevenueBarChart({ data }: { data: DailyRevenuePoint[] }) {
  const max = Math.max(1, ...data.map((d) => d.total));
  // Altura reservada: 120px de barras + 24px de labels + padding.
  // Largura: 7 colunas com gap. Total ~560px (responsivo por viewBox).
  const W = 560;
  const H = 168;
  const paddingY = 12;
  const innerH = H - paddingY * 2 - 24; // 24px de label embaixo
  const colGap = 16;
  const innerW = W - colGap * 2;
  const colW = (innerW - colGap * (data.length - 1)) / data.length;

  return (
    <div className="w-full">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-44 w-full"
        role="img"
        aria-label="Vendas dos últimos 7 dias"
      >
        <title>Vendas dos últimos 7 dias</title>
        {data.map((d, i) => {
          const h = Math.max(2, (d.total / max) * innerH);
          const x = colGap + i * (colW + colGap);
          const y = H - 24 - h;
          return (
            <g key={d.dia}>
              <rect
                x={x}
                y={y}
                width={colW}
                height={h}
                rx={6}
                className="fill-brand-500 transition-all hover:fill-brand-600"
              >
                <title>
                  {DOW_SHORT_PT[d.dow]} · {d.dia} · {formatCurrency(d.total)}
                </title>
              </rect>
              {/* label do dia */}
              <text
                x={x + colW / 2}
                y={H - 8}
                textAnchor="middle"
                className="fill-stone-500 text-[10px] font-medium"
              >
                {DOW_SHORT_PT[d.dow]}
              </text>
              {/* label do valor quando > 0 */}
              {d.total > 0 && (
                <text
                  x={x + colW / 2}
                  y={y - 4}
                  textAnchor="middle"
                  className="fill-stone-600 text-[10px] font-semibold"
                >
                  {d.total >= 1000
                    ? `R$${(d.total / 1000).toFixed(1)}k`
                    : d.total.toFixed(0)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ====================================================================
// Donut (formas de pagamento)
// ====================================================================

export function PaymentDonut({ slices }: { slices: PaymentSlice[] }) {
  const total = slices.reduce((acc, s) => acc + s.orders_count, 0);
  if (total === 0) {
    return (
      <div className="flex h-44 items-center justify-center text-sm text-stone-400">
        Sem pedidos no período.
      </div>
    );
  }

  const R = 56;
  const cx = 80;
  const cy = 80;
  const stroke = 22;
  const circ = 2 * Math.PI * R;

  // Ordena pra fatia "Pix" ficar primeiro (visual appeal).
  const ordered: PaymentSlice[] = [...slices].sort((a, b) =>
    a.payment_method.localeCompare(b.payment_method),
  );

  const slicesWithOffsets = ordered.map((s, idx) => {
    const pct = s.orders_count / total;
    const dash = pct * circ;
    const offset = -ordered
      .slice(0, idx)
      .reduce((sum, item) => sum + (item.orders_count / total) * circ, 0);
    return { ...s, dash, offset };
  });

  return (
    <div className="flex items-center gap-4">
      <svg
        viewBox="0 0 160 160"
        className="h-44 w-44 shrink-0"
        role="img"
        aria-label="Distribuição por forma de pagamento"
      >
        <title>Formas de pagamento</title>
        <g transform={`rotate(-90 ${cx} ${cy})`}>
          {slicesWithOffsets.map((s) => (
            <circle
              key={s.payment_method}
              cx={cx}
              cy={cy}
              r={R}
              fill="none"
              stroke={`rgb(${PAYMENT_META[s.payment_method].rgb})`}
              strokeWidth={stroke}
              strokeDasharray={`${s.dash} ${circ - s.dash}`}
              strokeDashoffset={s.offset}
            >
              <title>
                {PAYMENT_META[s.payment_method].label}: {s.orders_count} pedidos ·{" "}
                {formatCurrency(s.revenue)}
              </title>
            </circle>
          ))}
        </g>
        {/* Centro: total */}
        <text
          x={cx}
          y={cy - 2}
          textAnchor="middle"
          className="fill-stone-900 text-[20px] font-bold"
        >
          {total}
        </text>
        <text
          x={cx}
          y={cy + 14}
          textAnchor="middle"
          className="fill-stone-500 text-[10px] font-medium"
        >
          pedidos
        </text>
      </svg>

      <ul className="space-y-2 text-sm">
        {ordered.map((s) => {
          const pct = total > 0 ? (s.orders_count / total) * 100 : 0;
          return (
            <li key={s.payment_method} className="flex items-center gap-2">
              <span
                className={cn("h-3 w-3 rounded-full", PAYMENT_META[s.payment_method].tone)}
                aria-hidden
              />
              <span className="font-medium text-stone-700">
                {PAYMENT_META[s.payment_method].label}
              </span>
              <span className="text-stone-500">
                · {s.orders_count} · {pct.toFixed(0)}%
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ====================================================================
// Barra de progresso (Top produtos)
// ====================================================================

export function TopProductsList({
  items,
}: {
  items: { name: string; quantity: number }[];
}) {
  if (items.length === 0) {
    return <p className="text-sm text-stone-500">Sem vendas no período.</p>;
  }
  const max = Math.max(...items.map((i) => i.quantity), 1);
  return (
    <ul className="space-y-2 text-sm">
      {items.map((p, idx) => {
        const pct = (p.quantity / max) * 100;
        return (
          <li key={`${p.name}-${idx}`}>
            <div className="flex items-baseline justify-between gap-2">
              <span className="truncate font-medium text-stone-800">{p.name}</span>
              <span className="shrink-0 text-stone-600">{p.quantity}x</span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-stone-100">
              <div
                className="h-full rounded-full bg-brand-500"
                style={{ width: `${pct}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
