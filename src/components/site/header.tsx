import Link from "next/link";
import Image from "next/image";
import { getBusinessHours, getSettings } from "@/lib/queries/catalogo";
import { StatusLoja } from "./status-loja";

export async function SiteHeader() {
  const [settings, hours] = await Promise.all([getSettings(), getBusinessHours()]);

  return (
    <header className="sticky top-0 z-40 border-b border-brand-900/10 bg-cream-50/80 backdrop-blur-lg backdrop-saturate-150">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3.5">
        <Link href="/" className="flex items-center gap-3">
          {settings.logo_url ? (
            <Image
              src={settings.logo_url}
              alt={settings.business_name}
              width={48}
              height={48}
              className="h-12 w-12 rounded-full object-cover shadow-sm"
            />
          ) : (
            <span
              className="flex h-12 w-12 items-center justify-center rounded-full bg-linear-to-br from-brand-600 to-brand-800 text-lg font-bold text-white shadow-sm"
              aria-hidden
            >
              M
            </span>
          )}
          <span className="text-lg font-extrabold tracking-tight text-brand-900">{settings.business_name}</span>
        </Link>
        <StatusLoja hours={hours} manualClosed={settings.manual_closed} />
      </div>
    </header>
  );
}
