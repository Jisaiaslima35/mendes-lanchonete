import Link from "next/link";
import { ShieldAlert, LogOut, ArrowLeft } from "lucide-react";
import { requireSuperAdmin } from "@/lib/auth/super-admin";
import { logoutAdmin } from "@/lib/actions/admin-auth";
import { Button } from "@/components/ui/button";

/**
 * Layout do painel /super-admin — SaaS-level (host-agnostic).
 *
 * Gate de auth: `requireSuperAdmin()` checa `role='owner'` em
 * qualquer tenant. Se nao passar, lanca `UnauthorizedError` que o
 * error boundary do Next renderiza como 401/403.
 *
 * Visual: topbar enxuto (sem sidebar de admin). Quem acessa aqui ja
 * entende que eh contexto global — nao precisa da UI do painel do
 * restaurante.
 */
export default async function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireSuperAdmin();

  return (
    <div className="min-h-screen bg-stone-50">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-brand-600" aria-hidden />
            <h1 className="text-lg font-semibold text-stone-900">Super-admin</h1>
            <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">
              SaaS
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/admin">
              <Button type="button" variant="outline" size="sm">
                <ArrowLeft className="h-4 w-4" aria-hidden />
                Voltar ao painel
              </Button>
            </Link>
            <form action={logoutAdmin}>
              <Button type="submit" variant="outline" size="sm">
                <LogOut className="h-4 w-4" aria-hidden />
                Sair
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}
