import "server-only";

import { cache } from "react";
import { createServerSupabase } from "@/lib/supabase/server";
import { UnauthorizedError } from "@/lib/errors";

/**
 * Gate de super-admin: garante que o usuario autenticado tem a flag
 * EXPLICITA `is_super_admin=true` em algum registro de `admins`.
 *
 * IMPORTANTE: ser owner de uma loja NAO basta. Donos de loja comuns
 * (ex: formiga@automacaojs.us) tem `role='owner'` na propria loja
 * mas NAO podem acessar /super-admin, ver o switcher de lojas, ou
 * listar outros tenants. A flag is_super_admin eh controlada direto
 * via SQL — sem frontend capaz de "se promover".
 *
 * Usa `cache()` do React para deduplicar a checagem dentro de uma mesma
 * request. Entre requests, sempre rebusca o user e a flag — sem cache
 * poisoning entre sessoes.
 *
 * Nao chama `getCurrentTenant()` propositalmente: super-admin opera
 * acima do escopo de tenant (host-agnostic).
 */
export const requireSuperAdmin = cache(async (): Promise<{ userId: string; email: string }> => {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !user.email) {
    throw new UnauthorizedError("Voce precisa estar autenticado.");
  }

  const { data: admins, error } = await supabase
    .from("admins")
    .select("is_super_admin, is_active")
    .eq("id", user.id)
    .eq("is_active", true);

  if (error) {
    throw new UnauthorizedError("Nao foi possivel verificar suas permissoes.");
  }

  const isSuperAdmin = (admins ?? []).some(
    (a: { is_super_admin: boolean; is_active: boolean }) =>
      a.is_super_admin === true && a.is_active,
  );

  if (!isSuperAdmin) {
    throw new UnauthorizedError(
      "Acesso restrito ao administrador da plataforma (is_super_admin=true).",
    );
  }

  return { userId: user.id, email: user.email };
});
