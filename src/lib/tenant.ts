import "server-only";

import { cache } from "react";
import { publicEnv } from "@/lib/env";
import { createServerSupabase } from "@/lib/supabase/server";
import { NotFoundError } from "@/lib/errors";
import type { Tenant } from "@/types/database";

/**
 * Resolve o tenant atual pelo slug configurado em NEXT_PUBLIC_TENANT_SLUG.
 * `cache()` deduplica a consulta dentro de uma mesma requisição (RSC).
 *
 * Preparado para multiempresa: no futuro, resolver por dominio/subdominio
 * dentro do proxy.ts e passar o resultado adiante, sem mudar quem consome isto.
 */
export const getCurrentTenant = cache(async (): Promise<Tenant> => {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("tenants")
    .select("*")
    .eq("slug", publicEnv.tenantSlug)
    .eq("is_active", true)
    .single();

  if (error || !data) {
  console.error("ERRO AO BUSCAR TENANT:", {
    error,
    data,
    slug: publicEnv.tenantSlug,
    supabaseUrl: publicEnv.supabaseUrl,
  });

  throw new NotFoundError(
    `Tenant "${publicEnv.tenantSlug}" nao encontrado ou inativo.`,
  );
}
  return data;
});

export const getCurrentTenantId = cache(async (): Promise<string> => {
  const tenant = await getCurrentTenant();
  return tenant.id;
});
