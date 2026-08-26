import { ExternalLink, MapPin, Phone, Clock } from "lucide-react";
import { getBusinessHours, getSettings } from "@/lib/queries/catalogo";
import { todayHoursLabel } from "@/lib/horario";

export async function SiteFooter() {
  const [s, hours] = await Promise.all([getSettings(), getBusinessHours()]);
  const endereco = [s.address_street, s.address_number, s.address_district, s.address_city]
    .filter(Boolean)
    .join(", ");

  return (
    <footer className="mt-8 bg-brand-900 px-4 py-8 text-sm text-cream-100/80">
      <div className="mx-auto max-w-3xl space-y-3">
        <p className="text-base font-semibold text-white">{s.business_name}</p>
        {endereco && (
          <p className="flex items-start gap-2">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span>{endereco}</span>
          </p>
        )}
        {s.phone && (
          <p className="flex items-center gap-2">
            <Phone className="h-4 w-4 shrink-0" aria-hidden />
            <span>{s.phone}</span>
          </p>
        )}
        <p className="flex items-center gap-2">
          <Clock className="h-4 w-4 shrink-0" aria-hidden />
          <span>{todayHoursLabel(hours)}</span>
        </p>
        <div className="flex gap-4 pt-1">
          {s.instagram_url && (
            <a
              href={s.instagram_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 hover:text-accent-400"
            >
              <ExternalLink className="h-4 w-4" aria-hidden />
              Instagram
            </a>
          )}
          {s.facebook_url && (
            <a
              href={s.facebook_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 hover:text-accent-400"
            >
              <ExternalLink className="h-4 w-4" aria-hidden />
              Facebook
            </a>
          )}
        </div>
        <p className="pt-2 text-xs text-cream-100/50">
          © {new Date().getFullYear()} {s.business_name}. Todos os direitos reservados.
        </p>
      </div>
    </footer>
  );
}
