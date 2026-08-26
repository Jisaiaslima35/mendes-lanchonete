import { LoginForm } from "@/components/admin/login-form";

export default function AdminLoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-stone-100 p-4">
      <div className="w-full max-w-sm rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
        <h1 className="mb-1 text-lg font-bold text-stone-900">Painel administrativo</h1>
        <p className="mb-6 text-sm text-stone-500">Mendes Lanchonete e Padaria</p>
        <LoginForm />
      </div>
    </div>
  );
}
