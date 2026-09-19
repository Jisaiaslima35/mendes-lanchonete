"use client";

import { useState, useTransition } from "react";
import {
  ExternalLink,
  Power,
  LayoutDashboard,
  UtensilsCrossed,
  MessageCircle,
  RotateCw,
  X,
  Loader2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  restartEvolution,
  toggleTenantActive,
} from "@/lib/actions/super-admin-tenants";
import { normalizeQrSrc } from "@/lib/qr";

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
  evolution_state: "open" | "close" | "connecting" | null;
  evolution_owner_jid: string | null;
  evolution_instance_name: string | null;
};

/**
 * Tabela de tenants — Client Component por causa do toggle on/off
 * (estado local + transicao) e ações WhatsApp (modal QR + restart).
 *
 * O link externo para a URL do tenant aponta para o subdomínio
 * correspondente. Sem https no link porque o Cloudflare Tunnel já
 * upgrade automaticamente.
 */
export function TenantTable({
  tenants,
  rootDomain,
}: {
  tenants: TenantRow[];
  rootDomain: string;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead className="bg-stone-50 text-left text-xs font-medium uppercase tracking-wide text-stone-500">
          <tr>
            <th className="px-4 py-3">Estabelecimento</th>
            <th className="px-4 py-3">Subdomínio</th>
            <th className="px-4 py-3">Contato do dono</th>
            <th className="px-4 py-3 text-right">Pedidos</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">WhatsApp</th>
            <th className="px-4 py-3 text-right">Ações</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-100">
          {tenants.map((t) => (
            <TenantRow key={t.id} tenant={t} rootDomain={rootDomain} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TenantRow({ tenant, rootDomain }: { tenant: TenantRow; rootDomain: string }) {
  const [isPending, startTransition] = useTransition();
  const [optimisticActive, setOptimisticActive] = useState(tenant.is_active);
  const [error, setError] = useState<string | null>(null);
  const [qrModal, setQrModal] = useState<{ qrcode: string } | null>(null);
  const [qrLoading, setQrLoading] = useState(false);

  function handleToggle() {
    const next = !optimisticActive;
    setOptimisticActive(next);
    setError(null);
    startTransition(async () => {
      const result = await toggleTenantActive({
        tenantId: tenant.id,
        isActive: next,
      });
      if (!result.ok) {
        setOptimisticActive(!next);
        setError(result.error);
      }
    });
  }

  function handleRestart() {
    setError(null);
    setQrLoading(true);
    startTransition(async () => {
      const result = await restartEvolution({ tenantId: tenant.id });
      setQrLoading(false);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (result.data.qrcode) {
        setQrModal({ qrcode: result.data.qrcode });
      } else {
        // Sem QR pode significar que ja voltou a open — força reload.
        window.location.reload();
      }
    });
  }

  const externalUrl = tenant.subdomain
    ? `https://${tenant.subdomain}`
    : `https://${tenant.slug}.${rootDomain}`;
  const adminUrl = `${externalUrl}/admin`;
  const cardapioUrl = `${externalUrl}/`;

  const waConnected = tenant.evolution_state === "open";
  const waConnecting = tenant.evolution_state === "connecting";
  const waDisconnected = !tenant.evolution_state || tenant.evolution_state === "close";

  return (
    <tr className="hover:bg-stone-50">
      <td className="px-4 py-3">
        <div className="font-medium text-stone-900">{tenant.name}</div>
        <div className="mt-0.5 font-mono text-xs text-stone-500">{tenant.slug}</div>
      </td>
      <td className="px-4 py-3">
        {tenant.subdomain ? (
          <a
            href={externalUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 font-mono text-xs text-brand-600 hover:underline"
          >
            {tenant.subdomain}
            <ExternalLink className="h-3 w-3" aria-hidden />
          </a>
        ) : (
          <span className="text-xs text-stone-400">—</span>
        )}
      </td>
      <td className="px-4 py-3 text-xs text-stone-600">
        {tenant.owner_phone ? (
          <div>
            <a
              href={`https://wa.me/${tenant.owner_phone}`}
              target="_blank"
              rel="noreferrer"
              className="text-brand-600 hover:underline"
            >
              {tenant.owner_phone}
            </a>
          </div>
        ) : null}
        {tenant.owner_email ? (
          <div className="text-stone-500">{tenant.owner_email}</div>
        ) : null}
        {!tenant.owner_phone && !tenant.owner_email ? (
          <span className="text-stone-400">—</span>
        ) : null}
      </td>
      <td className="px-4 py-3 text-right font-mono text-stone-700">
        {tenant.total_orders}
      </td>
      <td className="px-4 py-3">
        {optimisticActive ? (
          <Badge tone="success">Ativo</Badge>
        ) : (
          <Badge tone="neutral">Inativo</Badge>
        )}
        {error ? <div className="mt-1 text-xs text-red-600">{error}</div> : null}
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-col gap-1">
          {waConnected ? (
            <Badge tone="success">Conectado</Badge>
          ) : waConnecting ? (
            <Badge tone="warning">Conectando</Badge>
          ) : (
            <Badge tone="danger">Desconectado</Badge>
          )}
          <div className="flex flex-wrap gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleRestart}
              disabled={qrLoading || waConnected}
              className="h-7 px-2 text-xs"
            >
              {qrLoading ? (
                <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
              ) : (
                <RotateCw className="h-3 w-3" aria-hidden />
              )}
              {waConnected ? "Forçar" : "Reiniciar"}
            </Button>
          </div>
          {tenant.evolution_owner_jid ? (
            <div className="font-mono text-[10px] text-stone-500">
              {tenant.evolution_owner_jid.split("@")[0]?.split(":")[0]}
            </div>
          ) : null}
        </div>
      </td>
      <td className="px-4 py-3 text-right">
        <div className="inline-flex flex-wrap items-center justify-end gap-1.5">
          <a
            href={adminUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-8 items-center justify-center gap-2 rounded-lg border border-stone-300 bg-white px-3 text-sm font-medium text-stone-900 transition-all hover:bg-stone-50"
          >
            <LayoutDashboard className="h-3.5 w-3.5" aria-hidden />
            Painel Admin
          </a>
          <a
            href={cardapioUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-8 items-center justify-center gap-2 rounded-lg border border-stone-300 bg-white px-3 text-sm font-medium text-stone-900 transition-all hover:bg-stone-50"
          >
            <UtensilsCrossed className="h-3.5 w-3.5" aria-hidden />
            Cardápio
          </a>
          <Button
            type="button"
            variant={optimisticActive ? "outline" : "secondary"}
            size="sm"
            onClick={handleToggle}
            disabled={isPending}
          >
            <Power className="h-3.5 w-3.5" aria-hidden />
            {optimisticActive ? "Desativar" : "Ativar"}
          </Button>
        </div>
      </td>

      {qrModal && (
        <tr>
          <td colSpan={7} className="border-t border-stone-100 bg-stone-50 px-4 py-4">
            <div className="flex items-start gap-4">
              <div className="h-44 w-44 shrink-0 overflow-hidden rounded-lg border border-stone-200 bg-white p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={normalizeQrSrc(qrModal.qrcode)}
                  alt="QR Code WhatsApp"
                  className="h-full w-full object-contain"
                />
              </div>
              <div className="flex-1 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-stone-900">
                    QR de pareamento — {tenant.name}
                  </p>
                  <button
                    type="button"
                    onClick={() => setQrModal(null)}
                    className="rounded p-1 text-stone-400 hover:bg-stone-200 hover:text-stone-700"
                    aria-label="Fechar"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <p className="text-xs text-stone-600">
                  Escaneie com o WhatsApp do dono da loja. Quando
                  conectar, esta janela pode ser fechada.
                </p>
                <p className="font-mono text-[11px] text-stone-500">
                  {tenant.evolution_instance_name ?? tenant.slug}
                </p>
              </div>
            </div>
          </td>
        </tr>
      )}
    </tr>
  );
}
