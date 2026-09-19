"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ClipboardList,
  Settings,
  QrCode,
  LogOut,
  UtensilsCrossed,
  Tags,
  PlusCircle,
  MapPin,
  Percent,
  Users,
  ShieldAlert,
  MessageCircle,
} from "lucide-react";
import { logoutAdmin } from "@/lib/actions/admin-auth";
import { cn } from "@/lib/utils";
import { TenantSwitcher, type TenantOption } from "@/components/admin/tenant-switcher";

const LINKS = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/pedidos", label: "Pedidos", icon: ClipboardList },
  { href: "/admin/produtos", label: "Produtos", icon: UtensilsCrossed },
  { href: "/admin/categorias", label: "Categorias", icon: Tags },
  { href: "/admin/adicionais", label: "Adicionais", icon: PlusCircle },
  { href: "/admin/bairros", label: "Bairros", icon: MapPin },
  { href: "/admin/promocoes", label: "Promoções", icon: Percent },
  { href: "/admin/clientes", label: "Clientes", icon: Users },
  { href: "/admin/qrcode", label: "QR Code", icon: QrCode },
  { href: "/admin/whatsapp", label: "WhatsApp", icon: MessageCircle },
  { href: "/admin/configuracoes", label: "Configurações", icon: Settings },
];

type Props = {
  isSuperAdmin: boolean;
  tenants: TenantOption[];
  currentTenantSlug: string | null;
  rootDomain: string;
};

export function AdminSidebar({ isSuperAdmin, tenants, currentTenantSlug, rootDomain }: Props) {
  const pathname = usePathname();

  return (
    <nav className="flex h-full flex-col justify-between border-r border-stone-200 bg-white p-3">
      <div className="space-y-3">
        {/* Switcher de lojas — só aparece pra super-admin da PLATAFORMA
            (is_super_admin=true). Donos de loja comuns não veem. */}
        {isSuperAdmin && tenants.length > 0 && (
          <TenantSwitcher
            tenants={tenants}
            currentTenantSlug={currentTenantSlug}
            rootDomain={rootDomain}
          />
        )}

        {/* Link destacado pra /super-admin — só aparece pra super-admin.
            Donos de loja (mesmo sendo "owner" da propria loja) não veem. */}
        {isSuperAdmin && (
          <Link
            href="/super-admin"
            className={cn(
              "flex items-center gap-2 rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-sm font-semibold",
              pathname?.startsWith("/super-admin")
                ? "border-brand-500 bg-brand-100 text-brand-800"
                : "text-brand-700 hover:bg-brand-100",
            )}
          >
            <ShieldAlert className="h-4 w-4" aria-hidden />
            Super Admin
            <span className="ml-auto rounded-full bg-brand-200 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand-800">
              SaaS
            </span>
          </Link>
        )}

        {/* Links padrão do admin da loja. */}
        <div className="space-y-1">
          {LINKS.map(({ href, label, icon: Icon }) => {
            const active = href === "/admin" ? pathname === href : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium",
                  active ? "bg-brand-50 text-brand-700" : "text-stone-600 hover:bg-stone-100",
                )}
              >
                <Icon className="h-4 w-4" aria-hidden />
                {label}
              </Link>
            );
          })}
        </div>
      </div>
      <form action={logoutAdmin}>
        <button
          type="submit"
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-stone-600 hover:bg-stone-100"
        >
          <LogOut className="h-4 w-4" aria-hidden />
          Sair
        </button>
      </form>
    </nav>
  );
}
