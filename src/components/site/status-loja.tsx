import { isStoreOpen, nextOpeningLabel } from "@/lib/horario";
import type { BusinessHour } from "@/types/database";

export function StatusLoja({
  hours,
  manualClosed,
}: {
  hours: BusinessHour[];
  manualClosed: boolean;
}) {
  const aberta = isStoreOpen(hours, manualClosed);

  if (aberta) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-800 shadow-xs">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" aria-hidden />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-600" aria-hidden />
        </span>
        Aberto agora
      </span>
    );
  }

  const proxima = nextOpeningLabel(hours);
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-bold text-red-700 shadow-xs">
      <span className="h-2 w-2 rounded-full bg-red-500" aria-hidden />
      Fechado{proxima ? ` — ${proxima}` : ""}
    </span>
  );
}
