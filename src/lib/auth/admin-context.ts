import "server-only";

import { cache } from "react";
import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import type { AdminRole } from "@/types/database";

export type TenantOption = {
  slug: string;
  subdomain: string | null;
  name: string;
};

export type AdminContext = {
  userId: string;
  email: string;
  role: AdminRole;
  isOwner: boolean;
  isSuperAdmin: boolean;
};

/**
 * Contexto do admin logado + lista de tenants ativos (pra switcher).
 *
 * IMPORTANTE: existe diferença crítica entre `isOwner` e `isSuperAdmin`.
 *
 * - `isOwner` = role='owner' em QUALQUER tenant. Donos de loja (ex:
 *   `formiga@automacaojs.us`) são owners da PRÓPRIA loja mas NÃO devem
 *   ter acesso SaaS-level (não listam outras lojas, não acessam
 *   /super-admin). Usado pela UI de admin da própria loja (ex:
 *   configuracoes).
 *
 * - `isSuperAdmin` = flag EXPLÍCITA no DB (`admins.is_super_admin`).
 *   Reservado ao(s) administrador(es) da PLATAFORMA (Isaías). Único
 *   que pode: ver o dropdown "Trocar Loja", acessar /super-admin,
 *   gerenciar todos os tenants.
 *
 * Retorna `null` se não tiver ninguém logado ou sem registro em `admins`.
 * O `AdminSidebar` interpreta null como "não mostrar switcher + não
 * mostrar link /super-admin" (comportamento padrão).
 */
export const getAdminContext = cache(async (): Promise<AdminContext | null> => {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !user.email) return null;

  const { data: admins } = await supabase
    .from("admins")
    .select("role, is_active, is_super_admin")
    .eq("id", user.id)
    .eq("is_active", true);

  const rows = admins ?? [];
  if (rows.length === 0) return null;

  // Mesmo calculo de role max que loginAdmin — priority owner > manager > staff.
  const priority: Record<AdminRole, number> = { owner: 3, manager: 2, staff: 1 };
  const role = rows.reduce<AdminRole>(
    (acc, r) => (priority[r.role as AdminRole] > priority[acc] ? (r.role as AdminRole) : acc),
    "staff",
  );
  const isOwner = rows.some((r) => r.role === "owner");
  const isSuperAdmin = rows.some((r) => r.is_super_admin === true);

  return {
    userId: user.id,
    email: user.email,
    role,
    isOwner,
    isSuperAdmin,
  };
});

/**
 * Lista tenants ativos pra popular o dropdown de troca de loja.
 * Retorna [] se chamada sem user autenticado OU se não for super admin.
 *
 * Donos de loja comuns (formiga) NÃO veem o switcher — só o admin da
 * plataforma (Isaías). Mesmo se o user for owner da própria loja,
 * sem is_super_admin=true o switcher fica oculto.
 */
export async function listActiveTenantsForSwitcher(): Promise<TenantOption[]> {
  const ctx = await getAdminContext();
  if (!ctx) return [];

  // Bloqueio explícito: nao-super-admin nao ve outras lojas.
  if (!ctx.isSuperAdmin) return [];

  const supabase = createAdminSupabase();
  const { data, error } = await supabase
    .from("tenants")
    .select("name, slug, subdomain, is_active")
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (error) return [];

  return (data ?? []).map((t) => ({
    slug: String(t.slug),
    subdomain: (t.subdomain as string | null) ?? null,
    name: String(t.name),
  }));
}
