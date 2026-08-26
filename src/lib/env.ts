/**
 * Acesso centralizado e validado as variaveis de ambiente.
 *
 * As variaveis `NEXT_PUBLIC_*` sao referenciadas de forma literal para que o
 * bundler do Next consiga inline-a-las no bundle do cliente.
 */

function required(name: string, value: string | undefined): string {
  if (!value || value.trim() === "") {
    throw new Error(
      `Variavel de ambiente ausente: ${name}. Copie .env.example para .env.local e preencha os valores.`,
    );
  }
  return value.trim();
}

function optional(value: string | undefined, fallback: string): string {
  return value && value.trim() !== "" ? value.trim() : fallback;
}

/** Variaveis disponiveis no browser e no servidor. */
export const publicEnv = {
  supabaseUrl: required(
    "NEXT_PUBLIC_SUPABASE_URL",
    process.env.NEXT_PUBLIC_SUPABASE_URL,
  ),
  supabaseAnonKey: required(
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  ),
  siteUrl: optional(
    process.env.NEXT_PUBLIC_SITE_URL,
    "http://localhost:3000",
  ).replace(/\/$/, ""),
  tenantSlug: optional(process.env.NEXT_PUBLIC_TENANT_SLUG, "mendes"),
};

/**
 * Variaveis exclusivas do servidor.
 * Chamar esta funcao a partir de um Client Component lanca erro em runtime.
 */
export function serverEnv() {
  if (typeof window !== "undefined") {
    throw new Error("serverEnv() nao pode ser usado no cliente.");
  }
  return {
    supabaseServiceRoleKey: required(
      "SUPABASE_SERVICE_ROLE_KEY",
      process.env.SUPABASE_SERVICE_ROLE_KEY,
    ),
  };
}
