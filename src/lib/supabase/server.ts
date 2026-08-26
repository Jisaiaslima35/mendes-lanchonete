import "server-only";

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { publicEnv } from "@/lib/env";

// NOTA: nao passar o generico <Database> aqui — em supabase-js 2.111 isso
// colapsa os tipos de linha das tabelas para `never` quando o schema tem mais
// de uma tabela (bug reproduzido isoladamente fora deste projeto). Os
// consumidores tipam o retorno via anotacao de funcao ou cast explicito.
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
              cookieStore.set(name, value, options);
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
