import { LoginForm } from "@/components/admin/login-form";
import { getCurrentTenantSafe } from "@/lib/tenant";

// Multi-tenant: o subtítulo do card de login precisa refletir o nome do
// tenant ativo (slug → tenant.name). Antes era "Mendes Lanchonete e Padaria"
// hardcoded em TODO subdomínio — bug que o Isaías reportou em msg 4856.
export default async function AdminLoginPage() {
  const tenant = await getCurrentTenantSafe();
  const storeName = tenant?.name ?? "Mendes Lanchonete";
  return (
    <div className="flex min-h-screen items-center justify-center bg-stone-100 p-4">
      <div className="w-full max-w-sm rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
        <h1 className="mb-1 text-lg font-bold text-stone-900">Painel administrativo</h1>
        <p className="mb-6 text-sm text-stone-500">{storeName}</p>
        <LoginForm />
      </div>
    </div>
  );
}
