"use client";

import { useMesa } from "@/lib/mesa/contexto";

/**
 * Banner persistente pro cliente da mesa. Aparece em qualquer rota da loja
 * enquanto o MesaProvider tiver uma mesa válida (cookie/localStorage ou URL).
 *
 * Antes lia `useSearchParams` direto — agora consome o MesaProvider, que
 * mantém a mesa viva mesmo se o cliente navegar sem a querystring.
 */
export function MesaBanner() {
  const { mesa, isHidratado } = useMesa();
  // Não renderiza no SSR (evita hydration mismatch) e nem sem mesa.
  if (!isHidratado || !mesa) return null;

  return (
    <div className="mb-3 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-900 shadow-sm">
      <span aria-hidden className="text-lg">📍</span>
      <div className="flex-1">
        <p className="font-semibold">
          Atendimento no Local — Mesa {mesa}
        </p>
        <p className="text-xs text-emerald-700">
          Sem taxa de entrega. Você verá essa identificação até finalizar o pedido.
        </p>
      </div>
      <span className="rounded-full bg-emerald-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-900">
        Mesa
      </span>
    </div>
  );
}
