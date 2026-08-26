import "server-only";

import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { publicEnv, serverEnv } from "@/lib/env";

// NOTA: nao anotar com `ReturnType<typeof createClient<...>>` nem passar o
// generico <Database> aqui — em supabase-js 2.111 ambos colapsam os tipos de
// linha das tabelas para `never` quando o schema tem mais de uma tabela (bug
// reproduzido isoladamente fora deste projeto). Por isso o cliente e'
// propositalmente nao tipado; os call sites fazem cast explicito para os
// tipos de src/types/database.ts.
let cached: SupabaseClient | null = null;

/**
 * Cliente com service_role. IGNORA RLS.
 *
 * Use somente em codigo de servidor confiavel: criacao de pedidos (para
 * recalcular precos no backend), leitura do pedido pelo token publico e
 * operacoes administrativas ja autorizadas.
 */
export function createAdminSupabase() {
  if (!cached) {
    cached = createSupabaseClient(publicEnv.supabaseUrl, serverEnv().supabaseServiceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return cached;
}
