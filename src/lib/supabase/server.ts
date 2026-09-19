import "server-only";

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { publicEnv } from "@/lib/env";

// NOTA: nao passar o generico <Database> aqui — em supabase-js 2.111 isso
// colapsa os tipos de linha das tabelas para `never` quando o schema tem mais
// de uma tabela (bug reproduzido isoladamente fora deste projeto). Os
// consumidores tipam o retorno via anotacao de funcao ou cast explicito.

/**
 * Domain compartilhado pros cookies do Supabase em todos os subdominios do
 * SaaS (mendes-teste.automacaojs.us, formiga.automacaojs.us, etc). Sem isso
 * a sessao fica presa no subdominio onde o login foi feito — abrir
 * formiga.automacaojs.us apos logar em mendes-teste.automacaojs.us pede
 * login de novo.
 *
 * O ponto na frente (".automacaojs.us") e' o formato RFC 6265 para cookies
 * de dominio compartilhado entre subdominios.
 *
 * So' sobrescreve `domain` para cookies do Supabase (prefixo `sb-`) — nao
 * toca nos outros cookies (ex: theme, locale) que sao por-subdominio mesmo.
 */
const ROOT_DOMAIN = `.${publicEnv.rootDomain}`;
function withCrossSubdomain(
  options: Record<string, unknown> | undefined,
  name: string,
): Record<string, unknown> {
  if (!name.startsWith("sb-")) return options ?? {};
  return { ...(options ?? {}), domain: ROOT_DOMAIN };
}

/**
 * Cliente Supabase para Server Components, Server Actions e Route Handlers.
 * Respeita RLS e usa a sessao do usuario armazenada em cookies.
 */
export async function createServerSupabase() {
  const cookieStore = await cookies();

  return createServerClient(
    publicEnv.supabaseUrl,
    publicEnv.supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, withCrossSubdomain(options, name));
            }
          } catch {
            // Server Components nao podem escrever cookies. A renovacao de
            // sessao acontece no proxy.ts, entao ignorar aqui e seguro.
          }
        },
      },
    },
  );
}
