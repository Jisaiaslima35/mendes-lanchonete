"use server";

import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { actionError, actionOk, type ActionResult } from "@/lib/errors";
import type { AdminRole } from "@/types/database";

type LoginPayload = {
  role: AdminRole;
  isOwner: boolean;
};

export async function loginAdmin(
  email: string,
  password: string,
): Promise<ActionResult<LoginPayload>> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    return actionError("E-mail ou senha inválidos.");
  }

  // owner de qualquer tenant = super-admin SaaS-level.
  const { data: admins } = await supabase
    .from("admins")
    .select("role, is_active")
    .eq("id", data.user.id)
    .eq("is_active", true);

  const rows = admins ?? [];
  if (rows.length === 0) {
    await supabase.auth.signOut();
    return actionError("Este usuário não tem acesso ao painel administrativo.");
  }

  // Pega o role mais alto do usuario entre os tenants (priority: owner > manager > staff).
  const priority: Record<AdminRole, number> = { owner: 3, manager: 2, staff: 1 };
  const role = rows.reduce<AdminRole>(
    (acc, r) => (priority[r.role as AdminRole] > priority[acc] ? (r.role as AdminRole) : acc),
    "staff",
  );
  const isOwner = rows.some((r) => r.role === "owner");

  return actionOk({ role, isOwner });
}

export async function logoutAdmin() {
  const supabase = await createServerSupabase();
  await supabase.auth.signOut();
  redirect("/admin/login");
}
