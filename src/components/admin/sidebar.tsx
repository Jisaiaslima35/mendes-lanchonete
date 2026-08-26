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
} from "lucide-react";
import { logoutAdmin } from "@/lib/actions/admin-auth";
import { cn } from "@/lib/utils";

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
  { href: "/admin/configuracoes", label: "Configurações", icon: Settings },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <nav className="flex h-full flex-col justify-between border-r border-stone-200 bg-white p-3">
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
