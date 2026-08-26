import { isStoreOpen, nextOpeningLabel } from "@/lib/horario";
import { Badge } from "@/components/ui/badge";
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
      <Badge tone="neutral" className="gap-1.5 bg-whatsapp-100 text-whatsapp-700">
        <span className="relative flex h-2 w-2">
          <span className="absolute h-2 w-2 animate-pulse-soft rounded-full bg-whatsapp-500" aria-hidden />
        </span>
        Aberto agora
      </Badge>
    );
  }

  const proxima = nextOpeningLabel(hours);
  return (
    <Badge tone="danger" className="gap-1.5">
      <span className="h-2 w-2 rounded-full bg-red-600" aria-hidden />
      Fechado{proxima ? ` — ${proxima}` : ""}
    </Badge>
  );
}
