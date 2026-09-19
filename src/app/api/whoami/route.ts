import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { publicEnv } from "@/lib/env";
import { getCurrentTenant, getCurrentTenantId } from "@/lib/tenant";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const h = await headers();
  const host = h.get("host");
  const xTenantSlug = h.get("x-tenant-slug");
  const envFallback = publicEnv.tenantSlug;

  let tenant: { id: string; slug: string; name: string; evolution_instance_name: string | null } | null = null;
  let tenantError: string | null = null;
  let tenantId: string | null = null;
  try {
    const t = await getCurrentTenant();
    tenant = {
      id: t.id,
      slug: t.slug,
      name: t.name,
      evolution_instance_name: t.evolution_instance_name ?? null,
    };
    tenantId = await getCurrentTenantId();
  } catch (e) {
    tenantError = e instanceof Error ? e.message : String(e);
  }

  return NextResponse.json({
    host,
    xTenantSlug,
    envFallback,
    resolvedSlug: xTenantSlug ?? envFallback,
    tenant,
    tenantId,
    tenantError,
  });
}
