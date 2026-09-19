import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { publicEnv } from "@/lib/env";
import { resolveTenantSlugFromHost } from "@/lib/tenant-host";

/**
 * Root domain do SaaS multi-tenant com ponto na frente — RFC 6265 cookie
 * domain compartilhado entre subdominios. Garante que a sessao do Supabase
 * (cookies `sb-*`) funcione em mendes-teste.automacaojs.us E
 * formiga.automacaojs.us simultaneamente.
 */
const CROSS_SUBDOMAIN_COOKIE_DOMAIN = `.${publicEnv.rootDomain}`;

/**
 * Filtra options de cookie para que o `domain` dos cookies do Supabase
 * seja forcado ao root compartilhado. Outros cookies (ex: theme, locale)
 * mantem o comportamento default por-subdominio.
 */
function cookieOptionsFor(name: string, options: Record<string, unknown> | undefined) {
  if (!name.startsWith("sb-")) return options ?? {};
  return { ...(options ?? {}), domain: CROSS_SUBDOMAIN_COOKIE_DOMAIN };
}

/**
 * Proxy Next.js 16 (antes chamado de "middleware").
 *
 * Roda antes de qualquer rota. Faz 3 coisas:
 * 1. Resolve o slug do tenant a partir do `Host` header (com fallback pro
 *    `NEXT_PUBLIC_TENANT_SLUG` do env quando o host nao bate com nenhum
 *    subdominio cadastrado — ex.: dev local, host externo).
 * 2. Propaga o slug como request header `x-tenant-slug` para os Server
 *    Components / Route Handlers / Server Actions (lido via `headers()`
 *    do `next/headers` em `src/lib/tenant.ts`).
 * 3. Renova a sessao Supabase a cada request e protege `/admin`
 *    redirecionando usuarios nao autenticados pra `/admin/login`.
 *
 * Importante: `NextResponse.next({ request: { headers } })` eh criado UMA
 * vez e reusado para que a renovacao de cookies da sessao Supabase
 * (`setAll`) seja propagada no response. Perder essa ligacao quebra o
 * refresh dos tokens de sessao (que expiram em ~1h).
 */
export async function proxy(request: NextRequest) {
  // 1) Tenant resolvido pelo Host (subdomain do rootDomain) — com fallback env.
  const host = request.headers.get("host");
  const slugFromHost = resolveTenantSlugFromHost(host);
  const slug = slugFromHost ?? publicEnv.tenantSlug;

  // Clona os headers do request e adiciona o slug resolvido. Vai ser
  // propagado para todos os Server Components / Route Handlers via
  // `headers()` do `next/headers`.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-tenant-slug", slug);

  // 2) Cria a response UMA vez com o request header customizado — base
  // para o `setAll` da sessao reaproveitar e propagar cookies de volta.
  let response = NextResponse.next({ request: { headers: requestHeaders } });

  const supabase = createServerClient(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        // Re-cria a response com o request header customizado + cookies novos.
        response = NextResponse.next({ request: { headers: requestHeaders } });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, cookieOptionsFor(name, options));
        }
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isLoginPage = pathname === "/admin/login";
  const isAdminRoute = pathname.startsWith("/admin");
  // /super-admin/* reusa o mesmo /admin/login — o gate de role='owner' eh
  // checado dentro do proprio layout (`src/app/super-admin/layout.tsx`)
  // via `requireSuperAdmin()`. Aqui no proxy so exigimos autenticacao.
  const isSuperAdminRoute = pathname.startsWith("/super-admin");

  if (isAdminRoute && !isLoginPage && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (isSuperAdminRoute && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (isLoginPage && user) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin";
    url.search = "";
    return NextResponse.redirect(url);
  }

  // Audit log — visivel via `journalctl -u mendes-teste -f`.
  console.info("[proxy] tenant resolved", { slug, host, source: slugFromHost ? "host" : "env" });

  return response;
}

// Matcher cobre TODAS as rotas (HTML, API, RSC, server actions).
// Exclui assets estaticos do Next e imagens para nao rodar em cada PNG.
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|webp|svg|gif|ico)$).*)",
  ],
};
