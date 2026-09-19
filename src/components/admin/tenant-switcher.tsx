"use client";

import { usePathname } from "next/navigation";
import { ChevronDown, Store } from "lucide-react";
import { cn } from "@/lib/utils";

type TenantOption = {
  slug: string;
  subdomain: string | null;
  name: string;
};

export type { TenantOption };

type Props = {
  tenants: TenantOption[];
  currentTenantSlug: string | null;
  rootDomain: string;
};

/**
 * Dropdown seletor de lojas (Tenants) — só aparece pra usuários com
 * role='owner' (super-admin SaaS-level). Permite alternar entre o admin
 * de cada tenant (ex.: mendes-teste, formiga) e o /super-admin sem
 * precisar digitar URL.
 *
 * Lógica de navegação:
 *   - Selecionar um tenant → monta URL `https://<subdomain>.<rootDomain>/admin`
 *     usando `window.location.href` (full page load, porque troca de host).
 *   - Selecionar "Super Admin" → navega pra `/super-admin` no host atual
 *     (host-agnostic, mesmo domínio do tenant atual).
 *   - Selecionar "Tenant atual (X)" → fica no lugar (current option).
 *
 * NOTA: troca de domínio é sempre full reload (não dá pra fazer client-side
 * nav porque o proxy resolve tenant por Host header — Next nem sabe do
 * novo tenant até o request chegar).
 */
export function TenantSwitcher({ tenants, currentTenantSlug, rootDomain }: Props) {
  const pathname = usePathname();
  const currentTenant = tenants.find((t) => t.slug === currentTenantSlug);
  const onSuperAdmin = pathname?.startsWith("/super-admin") ?? false;

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const value = e.target.value;
    if (value === "__current__") return;
    if (value === "__super-admin__") {
      window.location.href = "/super-admin";
      return;
    }
    const t = tenants.find((x) => x.slug === value);
    if (!t || !t.subdomain) return;
    // Full reload cross-host. O proxy do Next resolve o tenant pelo Host header.
    window.location.href = `https://${t.subdomain}.${rootDomain}/admin`;
  }

  return (
    <div className="rounded-lg border border-brand-200 bg-brand-50 p-2">
      <label
        htmlFor="tenant-switcher"
        className="flex items-center gap-1.5 px-1 pb-1 text-[10px] font-semibold uppercase tracking-wide text-brand-700"
      >
        <Store className="h-3 w-3" aria-hidden />
        Trocar loja
      </label>
      <div className="relative">
        <select
          id="tenant-switcher"
          value={onSuperAdmin ? "__super-admin__" : (currentTenantSlug ?? "__current__")}
          onChange={handleChange}
          className={cn(
            "w-full appearance-none rounded-md border border-brand-200 bg-white py-1.5 pl-2 pr-7",
            "text-xs font-medium text-stone-900",
            "focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500",
          )}
        >
          {currentTenant && (
            <option value="__current__">
              {currentTenant.name} (atual)
            </option>
          )}
          <option value="__super-admin__">🔐 Super Admin (SaaS)</option>
          <optgroup label="Lojas">
            {tenants.map((t) => (
              <option key={t.slug} value={t.slug}>
                {t.name} ({t.subdomain ?? t.slug})
              </option>
            ))}
          </optgroup>
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-1.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-stone-500"
          aria-hidden
        />
      </div>
    </div>
  );
}
