"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/env";

// NOTA: nao anotar com `ReturnType<typeof createBrowserClient<...>>` — em
// supabase-js 2.111 isso colapsa os tipos de linha das tabelas para `never`
// (bug reproduzido isoladamente fora deste projeto). Ver src/lib/supabase/admin.ts.
let cached: SupabaseClient | null = null;

/**
 * Cookie options do Supabase forçadas pro root domain do SaaS
 * (`.automacaojs.us`). Garante que a sessao (sb-*) seja compartilhada
 * entre todos os subdominios — sem isso, login em mendes-teste.automacaojs.us
 * nao autentica em formiga.automacaojs.us.
 */
const cookieOptions = {
  domain: `.${publicEnv.rootDomain}`,
  path: "/",
  sameSite: "lax" as const,
  // secure so' em prod (HTTPS). Em dev http://localhost:3000 falha se true.
  secure: typeof window !== "undefined" && window.location.protocol === "https:",
};

/** Cliente Supabase para uso em Client Components (chave anon + RLS). */
export function createClient() {
  if (!cached) {
    cached = createBrowserClient(
      publicEnv.supabaseUrl,
      publicEnv.supabaseAnonKey,
      { cookieOptions },
    );
  }
  return cached;
}
