/**
 * Resolver puro de `Host` header → slug do tenant.
 *
 * SEM acesso a banco. Usado pelo `src/proxy.ts` (Next 16) para decidir
 * qual tenant responder antes de chegar em qualquer Server Component.
 *
 * Regra: se o host for um subdomínio do `rootDomain` (configurável via
 * `NEXT_PUBLIC_ROOT_DOMAIN`, default `automacaojs.us`), retorna esse
 * subdomínio como slug. Caso contrário (localhost, apex, host externo,
 * host malformado), retorna `null` — o proxy cai pro fallback
 * `NEXT_PUBLIC_TENANT_SLUG` do env.
 *
 * Função pura = fácil de testar e sem efeito colateral.
 */

const DEFAULT_ROOT_DOMAIN = "automacaojs.us";

function rootDomain(): string {
  return (process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? DEFAULT_ROOT_DOMAIN).toLowerCase();
}

function stripPort(host: string): string {
  // host pode vir com porta (localhost:3000) — strip antes de processar
  const idx = host.indexOf(":");
  return (idx >= 0 ? host.slice(0, idx) : host).toLowerCase();
}

function isLocalHost(host: string): boolean {
  return (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "::1" ||
    host.endsWith(".localhost")
  );
}

/**
 * @param host - Valor cru do header `Host` (pode incluir porta).
 * @returns slug do tenant se for subdomínio válido do rootDomain, `null` caso contrário.
 */
export function resolveTenantSlugFromHost(host: string | null): string | null {
  if (!host) return null;
  const clean = stripPort(host);

  // Localhost / 127.0.0.1 → fallback env (dev local)
  if (isLocalHost(clean)) return null;

  const root = rootDomain();

  // Apex sem subdomínio (ex: automacaojs.us) → fallback env
  if (clean === root) return null;

  // Host que NÃO é subdomínio do nosso root → fallback env (host externo,
  // typo, ataque — não redirecionamos, deixamos o `getCurrentTenant` falhar
  // explicitamente se realmente cair em algum lugar que dependa de tenant)
  if (!clean.endsWith(`.${root}`)) return null;

  const sub = clean.slice(0, clean.length - root.length - 1);

  // slug DNS-LDH válido: letras, dígitos, hífen; 1-63 chars; não começa/termina com hífen
  if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(sub)) return null;

  return sub.toLowerCase();
}

/** Expõe o rootDomain configurado — útil pra debug e pra UI exibir
 *  "Você está acessando {slug}.{rootDomain}" no super-admin. */
export function getRootDomain(): string {
  return rootDomain();
}

/**
 * Resolve a ORIGEM publica (scheme://host) que o cliente final deve usar
 * para acessar ESTE tenant. Em produção multi-tenant cada tenant tem
 * seu próprio subdomínio (`formiga.automacaojs.us`, `mendes-teste.automacaojs.us`)
 * — e o QR Code / link de pagamento / webhook do WhatsApp devem apontar
 * para o subdomínio do tenant, nunca para uma URL estática do env.
 *
 * Regra:
 *   - Se o host do request for subdomínio do rootDomain → usa ele
 *     (preserva a porta em dev, ex: `formiga.automacaojs.us:3000`).
 *   - Se for localhost / 127.0.0.1 (dev local sem proxy de host)
 *     → usa o `NEXT_PUBLIC_SITE_URL` do env como fallback (o dev
 *     pode estar acessando via IP/porta e o subdomínio não resolve).
 *   - Caso contrário (host externo, apex sem sub) → monta
 *     `https://{slug}.{rootDomain}` com base no slug passado.
 *
 * @param host      Valor cru do header `Host` (pode incluir porta).
 * @param slug      Slug do tenant ativo na request.
 * @returns Origem completa sem barra final, ex: `https://formiga.automacaojs.us`.
 */
export function resolveTenantOrigin(host: string | null, slug: string): string {
  const cleanHost = stripPort(host ?? "");
  const root = rootDomain();

  // Host bate com nosso rootDomain → usa exatamente o que o cliente está vendo.
  if (cleanHost && (cleanHost === root || cleanHost.endsWith(`.${root}`))) {
    const port = (host ?? "").indexOf(":") >= 0 ? host!.slice(host!.indexOf(":")) : "";
    return `https://${cleanHost}${port}`;
  }

  // Dev local (localhost / 127.0.0.1) → fallback env pra conseguir testar.
  if (cleanHost && isLocalHost(cleanHost)) {
    const env = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");
    if (env) return env;
    // Sem env configurado, monta com porta típica do Next.
    const port = (host ?? "").indexOf(":") >= 0 ? host!.slice(host!.indexOf(":")) : ":3000";
    return `http://${cleanHost}${port}`;
  }

  // Host externo / apex / subdomínio de outro root → monta canônico.
  return `https://${slug}.${root}`;
}
