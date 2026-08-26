"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/env";

// NOTA: nao anotar com `ReturnType<typeof createBrowserClient<...>>` — em
// supabase-js 2.111 isso colapsa os tipos de linha das tabelas para `never`
// (bug reproduzido isoladamente fora deste projeto). Ver src/lib/supabase/admin.ts.
let cached: SupabaseClient | null = null;

/** Cliente Supabase para uso em Client Components (chave anon + RLS). */
export function createClient() {
  if (!cached) {
    cached = createBrowserClient(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey);
  }
  return cached;
}
