import { createServerSupabase } from "@/lib/supabase/server";
import { getCurrentTenantId } from "@/lib/tenant";
import { formatCurrency, round2 } from "@/lib/utils";
import { ORDER_STATUS_LABELS } from "@/lib/pedido-status";
import {
  DailyRevenueBarChart,
  PaymentDonut,
  TopProductsList,
  type DailyRevenuePoint,
  type PaymentSlice,
} from "@/components/admin/charts/dashboard-charts";
import {
  ExportActions,
  PrintHeader,
  type ExportRow,
} from "@/components/admin/charts/export-actions";
import { PrintOrdersTable } from "@/components/admin/charts/print-table";
import { TrendingUp, TrendingDown } from "lucide-react";
import type { OrderStatus } from "@/types/database";

type Metrics = {
  orders_count: number;
  revenue: number;
  avg_ticket: number;
  by_status: { status: string; count: number }[];
  top_products: { name: string; quantity: number }[];
};

/**
 * Devolve o range de um único dia (00:00:00 até 23:59:59.999) num fuso
 * arbitrário. Trabalhamos em America/Sao_Paulo pra casar com o "hoje" do
 * painel mesmo quando o servidor tá em UTC.
 */
function dayRange(localDate: Date) {
  const start = new Date(localDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(localDate);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

/** YYYY-MM-DD no fuso America/Sao_Paulo. */
function isoDate(d: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/** Day-of-week no fuso America/Sao_Paulo. */
function dow(d: Date) {
  const s = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    weekday: "short",
  }).format(d);
  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return map[s] ?? 0;
}

export default async function AdminDashboardPage() {
  const supabase = await createServerSupabase();
  const tenantId = await getCurrentTenantId();

  const today = new Date();
  const todayRange = dayRange(today);

  // 7 dias = hoje + 6 dias anteriores.
  const days: Date[] = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - (6 - i));
    return d;
  });

  // Range "últimos 7 dias" (incluindo hoje) para agregados.
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - 6);
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(today);
  weekEnd.setHours(23, 59, 59, 999);

  // ============ Fan-out paralelo ============
  // 7 chamadas daily + 1 agregada semanal + 1 query payment breakdown.
  const dailyPromises = days.map((d) => {
    const r = dayRange(d);
    return supabase.rpc("dashboard_metrics", {
      p_tenant: tenantId,
      p_from: r.start.toISOString(),
      p_to: r.end.toISOString(),
    });
  });
  const weekAggPromise = supabase.rpc("dashboard_metrics", {
    p_tenant: tenantId,
    p_from: weekStart.toISOString(),
    p_to: weekEnd.toISOString(),
  });
  // by_payment não vem do RPC → busca direto na tabela orders.
  // Filtra cancelados pra não inflarem o faturamento.
  const paymentPromise = supabase
    .from("orders")
    .select("payment_method, total, status")
    .eq("tenant_id", tenantId)
    .gte("created_at", weekStart.toISOString())
    .lte("created_at", weekEnd.toISOString())
    .neq("status", "cancelado");

  // Pedidos detalhados dos últimos 7 dias → alimenta o CSV + tabela impressa.
  // Mantém cancelados pra histórico (a coluna Status reflete isso).
  const ordersForExportPromise = supabase
    .from("orders")
    .select(
      "id, order_number, created_at, customer_name, customer_phone, payment_method, status, delivery_fee, total",
    )
    .eq("tenant_id", tenantId)
    .gte("created_at", weekStart.toISOString())
    .lte("created_at", weekEnd.toISOString())
    .order("created_at", { ascending: false });

  const [dailyResults, weekRes, paymentRes, ordersRes] = await Promise.all([
    Promise.all(dailyPromises),
    weekAggPromise,
    paymentPromise,
    ordersForExportPromise,
  ]);

  // ============ Série de 7 dias ============
  const daily: DailyRevenuePoint[] = days.map((d, i) => {
    const r = dailyResults[i];
    const m = (r?.data ?? null) as Metrics | null;
    return {
      dia: isoDate(d),
      dow: dow(d),
      total: Number(m?.revenue ?? 0),
    };
  });

  // ============ Métricas agregadas ============
  const todayM = ((dailyResults[6]?.data ?? null) as Metrics | null) ?? {
    orders_count: 0,
    revenue: 0,
    avg_ticket: 0,
    by_status: [],
    top_products: [],
  };
  const weekM = ((weekRes?.data ?? null) as Metrics | null) ?? {
    orders_count: 0,
    revenue: 0,
    avg_ticket: 0,
    by_status: [],
    top_products: [],
  };

  // Comparativo: hoje vs média dos 6 dias anteriores.
  const previousDays = daily.slice(0, 6);
  const previousSum = previousDays.reduce((acc, d) => acc + d.total, 0);
  const previousAvg = previousSum / Math.max(previousDays.length, 1);
  const delta = previousAvg > 0 ? (todayM.revenue - previousAvg) / previousAvg : null;

  // 20% de economia em taxas de marketplace — destaque verde.
  const feesEconomy = round2(weekM.revenue * 0.2);

  // ============ Linhas para CSV + tabela impressa ============
  type OrderExportRow = {
    id: string;
    order_number: string | null;
    created_at: string;
    customer_name: string | null;
    customer_phone: string | null;
    payment_method: "pix" | "cash" | "card" | null;
    status: string | null;
    delivery_fee: number | string | null;
    total: number | string | null;
  };
  const exportRows: ExportRow[] = ((ordersRes.data ?? []) as OrderExportRow[]).map(
    (r) => ({
      id: r.id,
      order_number: r.order_number ?? `#${r.id.slice(0, 6)}`,
      created_at: r.created_at,
      customer_name: r.customer_name ?? "(sem nome)",
      customer_phone: r.customer_phone ?? "",
      payment_method: (r.payment_method ?? "pix") as ExportRow["payment_method"],
      status: (r.status ?? "recebido") as OrderStatus,
      delivery_fee: Number(r.delivery_fee ?? 0),
      total: Number(r.total ?? 0),
    }),
  );

  // Nome do estabelecimento para o cabeçalho do PDF.
  const businessName = "Mendes Lanchonete";

  // ============ Formas de pagamento (últimos 7 dias) ============
  type PaymentRow = {
    payment_method: "pix" | "cash" | "card";
    total: number | string;
  };
  const slices: PaymentSlice[] = (() => {
    const buckets = new Map<PaymentSlice["payment_method"], PaymentSlice>();
    const rows = (paymentRes.data ?? []) as PaymentRow[];
    for (const r of rows) {
      const method = (r.payment_method ?? "pix") as PaymentSlice["payment_method"];
      const cur = buckets.get(method) ?? {
        payment_method: method,
        orders_count: 0,
        revenue: 0,
      };
      cur.orders_count += 1;
      cur.revenue += Number(r.total ?? 0);
      buckets.set(method, cur);
    }
    return Array.from(buckets.values()).map((b) => ({
      ...b,
      revenue: round2(b.revenue),
    }));
  })();

  return (
    <div className="space-y-6">
      {/* Header do relatório impresso (escondido em tela, visível em @media print). */}
      <PrintHeader
        businessName={businessName}
        revenue7d={Number(weekM.revenue ?? 0)}
        ordersCount7d={Number(weekM.orders_count ?? 0)}
        feesEconomy={feesEconomy}
      />

      <div className="flex flex-wrap items-start justify-between gap-3 no-print">
        <div>
          <h1 className="text-xl font-bold text-stone-900">Dashboard — hoje</h1>
          <p className="text-sm text-stone-500">
            Visão geral — hoje e últimos 7 dias.
          </p>
        </div>
        <ExportActions rows={exportRows} />
      </div>

      {/* ============ Cards KPI ============ */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {/* Faturamento hoje + comparativo */}
        <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-stone-500">Faturamento hoje</p>
          <p className="mt-1 text-2xl font-bold text-stone-900">
            {formatCurrency(todayM.revenue)}
          </p>
          <p className="mt-1 flex items-center gap-1 text-xs">
            {delta == null ? (
              <span className="text-stone-400">sem base de comparação</span>
            ) : delta >= 0 ? (
              <span className="inline-flex items-center gap-1 text-emerald-700">
                <TrendingUp className="h-3.5 w-3.5" aria-hidden />
                +{(delta * 100).toFixed(0)}% vs média dos 6 dias anteriores
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-rose-700">
                <TrendingDown className="h-3.5 w-3.5" aria-hidden />
                {(delta * 100).toFixed(0)}% vs média dos 6 dias anteriores
              </span>
            )}
          </p>
        </div>

        {/* Total 7 dias */}
        <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-stone-500">Total últimos 7 dias</p>
          <p className="mt-1 text-2xl font-bold text-stone-900">
            {formatCurrency(weekM.revenue)}
          </p>
          <p className="mt-1 text-xs text-stone-500">
            {weekM.orders_count} pedidos no período
          </p>
        </div>

        {/* Ticket médio 7 dias */}
        <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-stone-500">Ticket médio (7d)</p>
          <p className="mt-1 text-2xl font-bold text-stone-900">
            {formatCurrency(weekM.avg_ticket)}
          </p>
          <p className="mt-1 text-xs text-stone-500">
            hoje: {formatCurrency(todayM.avg_ticket)}
          </p>
        </div>

        {/* Destaque verde — economia em taxas */}
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
          <p className="text-sm font-medium text-emerald-800">
            Economizado em taxas de marketplace
          </p>
          <p className="mt-1 text-2xl font-bold text-emerald-700">
            {formatCurrency(feesEconomy)}
          </p>
          <p className="mt-1 text-xs text-emerald-700">
            20% sobre o faturamento dos últimos 7 dias
          </p>
        </div>
      </div>

      {/* ============ Gráficos ============ */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm lg:col-span-2">
          <p className="mb-3 font-semibold text-stone-900">
            Vendas dos últimos 7 dias
          </p>
          <DailyRevenueBarChart data={daily} />
        </div>

        <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
          <p className="mb-3 font-semibold text-stone-900">Formas de pagamento</p>
          <PaymentDonut slices={slices} />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
          <p className="mb-3 font-semibold text-stone-900">
            Pedidos por status (hoje)
          </p>
          {todayM.by_status.length === 0 ? (
            <p className="text-sm text-stone-500">Sem pedidos hoje.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {todayM.by_status.map((s) => (
                <li key={s.status} className="flex justify-between">
                  <span>
                    {ORDER_STATUS_LABELS[s.status as keyof typeof ORDER_STATUS_LABELS] ??
                      s.status}
                  </span>
                  <span className="font-medium">{s.count}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
          <p className="mb-3 font-semibold text-stone-900">
            Mais vendidos (últimos 7 dias)
          </p>
          <TopProductsList items={weekM.top_products} />
        </div>
      </div>

      {/* Tabela completa dos pedidos — visível apenas na impressão. */}
      <PrintOrdersTable rows={exportRows} />
    </div>
  );
}
