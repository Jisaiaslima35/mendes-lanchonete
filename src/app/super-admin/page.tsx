import Link from "next/link";
import { headers } from "next/headers";
import { ExternalLink, Building2 } from "lucide-react";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { Badge } from "@/components/ui/badge";
import { TenantTable } from "@/components/super-admin/tenant-table";
import { NewTenantButton } from "@/components/super-admin/new-tenant-button";
import { publicEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

type TenantRow = {
  id: string;
  name: string;
  slug: string;
  subdomain: string | null;
  is_active: boolean;
  owner_phone: string | null;
  owner_email: string | null;
  created_at: string;
  total_orders: number;
  // Evolution — alimentados pelo webhook /api/webhooks/evolution.
  evolution_instance_name: string | null;
  evolution_state: "open" | "close" | "connecting" | null;
  evolution_owner_jid: string | null;
  evolution_connected_at: string | null;
  evolution_webhook_set: boolean;
};

/**
 * Pagina principal do /super-admin — lista todos os tenants com status,
 * slug, subdomain e total de pedidos. Botao "Novo Estabelecimento"
 * abre o modal de criacao.
 *
 * Usa `createAdminSupabase()` (service_role) porque o super-admin precisa
 * listar TODOS os tenants, inclusive inativos (RLS `tenants_select_public`
 * so retorna ativos). A autorizacao eh feita pelo `requireSuperAdmin()`
 * no layout.
 */
export default async function SuperAdminPage() {
  const supabase = createAdminSupabase();

  // Lista todos os tenants. Count de pedidos via subquery LEFT JOIN.
  const { data: tenants, error } = await supabase
    .from("tenants")
    .select(
      "id, name, slug, subdomain, is_active, owner_phone, owner_email, created_at, evolution_instance_name, evolution_state, evolution_owner_jid, evolution_connected_at, evolution_webhook_set, orders:orders(count)",
    )
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Erro ao listar tenants: {error.message}
      </div>
    );
  }

  // Normaliza orders(count) → number. Sem pedidos, vem `null` no count.
  const rows: TenantRow[] = (tenants ?? []).map((t) => {
    const orders = Array.isArray(t.orders) ? t.orders : [];
    const total = orders[0]?.count ?? 0;
    return {
      id: t.id,
      name: t.name,
      slug: t.slug,
      subdomain: t.subdomain,
      is_active: t.is_active,
      owner_phone: t.owner_phone,
      owner_email: t.owner_email,
      created_at: t.created_at,
      total_orders: Number(total) || 0,
      evolution_instance_name: t.evolution_instance_name ?? null,
      evolution_state: t.evolution_state ?? null,
      evolution_owner_jid: t.evolution_owner_jid ?? null,
      evolution_connected_at: t.evolution_connected_at ?? null,
      evolution_webhook_set: Boolean(t.evolution_webhook_set),
    };
  });

  const h = await headers();
  const currentHost = h.get("host") ?? "";
  const rootDomain = publicEnv.rootDomain;
  const activeCount = rows.filter((r) => r.is_active).length;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-stone-900">Estabelecimentos</h2>
          <p className="mt-1 text-sm text-stone-500">
            {rows.length} cadastrados, {activeCount} ativos. Host atual:{" "}
            <code className="rounded bg-stone-100 px-1.5 py-0.5 text-xs">{currentHost}</code>
          </p>
        </div>
        <NewTenantButton rootDomain={rootDomain} />
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-stone-300 bg-white p-12 text-center">
          <Building2 className="mx-auto h-10 w-10 text-stone-400" aria-hidden />
          <h3 className="mt-3 text-base font-semibold text-stone-900">
            Nenhum estabelecimento cadastrado
          </h3>
          <p className="mt-1 text-sm text-stone-500">
            Comece criando o primeiro com o botão acima.
          </p>
        </div>
      ) : (
        <TenantTable tenants={rows} rootDomain={rootDomain} />
      )}

      <section className="rounded-xl border border-stone-200 bg-white p-5">
        <h3 className="text-sm font-semibold text-stone-900">Como funciona</h3>
        <ul className="mt-2 space-y-1.5 text-sm text-stone-600">
          <li>
            Cada tenant é resolvido pelo <strong>subdomínio</strong> em{" "}
            <code className="rounded bg-stone-100 px-1 text-xs">.{rootDomain}</code>.
          </li>
          <li>
            Slug = primeiro label do FQDN (ex.: <code>mendes-teste.automacaojs.us</code>{" "}
            → slug <code>mendes-teste</code>).
          </li>
          <li>
            O admin mais antigo do novo tenant deve ser promovido a{" "}
            <Badge tone="brand">owner</Badge> para também ter acesso a este painel.
          </li>
          <li>
            Adicione a rota{" "}
            <code className="rounded bg-stone-100 px-1 text-xs">subdomain → localhost:3000</code>{" "}
            no Cloudflare Tunnel antes de o subdomínio ficar público.{" "}
            <Link
              href="https://github.com/cloudflare/cloudflared"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-brand-600 hover:underline"
            >
              cloudflared <ExternalLink className="h-3 w-3" aria-hidden />
            </Link>
          </li>
        </ul>
      </section>
    </div>
  );
}
