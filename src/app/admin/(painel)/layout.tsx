import { AdminSidebar } from "@/components/admin/sidebar";
import { getAdminContext, listActiveTenantsForSwitcher } from "@/lib/auth/admin-context";
import { getCurrentTenant } from "@/lib/tenant";
import { publicEnv } from "@/lib/env";

export default async function PainelLayout({ children }: { children: React.ReactNode }) {
  // Busca o contexto do admin logado. Se não tiver ninguém (rota pública),
  // getAdminContext retorna null — sidebar renderiza sem switcher/super-admin.
  const ctx = await getAdminContext();
  // listActiveTenantsForSwitcher já retorna [] pra quem não é super-admin,
  // mas passar `ctx?.isSuperAdmin` evita a query pra user comum.
  const tenants = ctx?.isSuperAdmin ? await listActiveTenantsForSwitcher() : [];
  // Slug do tenant atual via header x-tenant-slug setado pelo proxy.
  // Pode falhar em rotas que não dependem de tenant (ex: login) — fallback null.
  let currentTenantSlug: string | null = null;
  try {
    const t = await getCurrentTenant();
    currentTenantSlug = t.slug;
  } catch {
    currentTenantSlug = null;
  }

  return (
    // `print:grid-cols-1` no CSS de print esconde a sidebar (primeira coluna).
    <div className="grid min-h-screen grid-cols-[220px_1fr] bg-stone-50 print:grid-cols-1">
      <div className="no-print">
        <AdminSidebar
          isSuperAdmin={ctx?.isSuperAdmin ?? false}
          tenants={tenants}
          currentTenantSlug={currentTenantSlug}
          rootDomain={publicEnv.rootDomain}
        />
      </div>
      <main className="p-6 print:p-0">{children}</main>
    </div>
  );
}
