"use server";

import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { actionError, actionOk, type ActionResult } from "@/lib/errors";

export async function loginAdmin(email: string, password: string): Promise<ActionResult<undefined>> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    return actionError("E-mail ou senha inválidos.");
  }

  const { data: admin } = await supabase
    .from("admins")
    .select("id, is_active")
    .eq("id", data.user.id)
    .single();

  if (!admin || !admin.is_active) {
    await supabase.auth.signOut();
    return actionError("Este usuário não tem acesso ao painel administrativo.");
  }

  return actionOk();
}

export async function logoutAdmin() {
  const supabase = await createServerSupabase();
  await supabase.auth.signOut();
  redirect("/admin/login");
}
