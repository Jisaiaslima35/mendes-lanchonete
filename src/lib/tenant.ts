import "server-only";

import { cache } from "react";
import { headers } from "next/headers";
import { publicEnv } from "@/lib/env";
import { createServerSupabase } from "@/lib/supabase/server";
import { NotFoundError } from "@/lib/errors";
import type { Tenant } from "@/types/database";

/**
 * Multi-tenant SaaS: o slug do tenant e resolvido em duas camadas.
 *
 * 1) `src/proxy.ts` (Next 16 proxy, antes "middleware") le o `Host`
 *    header, extrai o subdomain (`formiga.automacaojs.us` -> `formiga`)
 *    e propaga como request header `x-tenant-slug` para toda a arvore
 *    de Server Components / Route Handlers / Server Actions.
 *
 * 2) Aqui em `tenant.ts`, lemos esse header via `headers()` do
 *    `next/headers`. Fallback para `publicEnv.tenantSlug` do env quando
 *    o proxy nao setou o header (dev local sem proxy, testes, ou host
 *    que nao bate com nenhum subdomain do rootDomain).
 *
 * `cache()` do React deduplica a consulta DENTRO de uma mesma request.
 * Entre requests, `headers()` sempre le o header fresco — sem risco de
 * cache poisoning entre tenants.
 */
async function resolveSlug(): Promise<string> {
  const h = await headers();
  const fromHeader = h.get("x-tenant-slug")?.trim();
  if (fromHeader) return fromHeader;
  return publicEnv.tenantSlug;
}

export const getCurrentTenant = cache(async (): Promise<Tenant> => {
  const slug = await resolveSlug();
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("tenants")
    .select("*")
    .eq("slug", slug)
    .eq("is_active", true)
    .single();

  if (error || !data) {
    console.error("ERRO AO BUSCAR TENANT:", {
      error,
      data,
      slug,
      supabaseUrl: publicEnv.supabaseUrl,
    });

    throw new NotFoundError(
      `Tenant "${slug}" nao encontrado ou inativo.`,
    );
  }
  return data;
});

export const getCurrentTenantId = cache(async (): Promise<string> => {
  const tenant = await getCurrentTenant();
  return tenant.id;
});

/**
 * Variante "safe" do `getCurrentTenant`: devolve `null` em vez de explodir
 * quando o tenant não é encontrado/inativo. Usado em contextos onde o
 * metadata precisa continuar renderizando mesmo sem tenant (ex:
 * `generateMetadata` no root layout — não pode quebrar TODAS as páginas
 * só porque o slug do proxy veio vazio).
 */
export const getCurrentTenantSafe = cache(async (): Promise<Tenant | null> => {
  try {
    const slug = await resolveSlug();
    const supabase = await createServerSupabase();
    const { data, error } = await supabase
      .from("tenants")
      .select("*")
      .eq("slug", slug)
      .eq("is_active", true)
      .maybeSingle();
    if (error || !data) return null;
    return data as Tenant;
  } catch {
    return null;
  }
});
