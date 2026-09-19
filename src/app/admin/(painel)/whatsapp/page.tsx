import { createServerSupabase } from "@/lib/supabase/server";
import { getCurrentTenantId } from "@/lib/tenant";
import { WhatsappConnectCard } from "@/components/admin/whatsapp-connect-card";
import { syncEvolutionStatus } from "@/lib/actions/admin-evolution";

/**
 * Tela /admin/whatsapp — gestão da instância Evolution API do tenant.
 *
 * IMPORTANTE: nao confiamos no estado cacheado em `tenants.evolution_*`
 * sem antes sondar a Evolution API. Se a instancia foi deletada por fora
 * (admin da Evolution clicou em Delete, restart do container, etc), o
 * banco pode dizer "open" mas a Evolution responde 404. Rodamos o
 * `syncEvolutionStatus` aqui — ele:
 *   1. bate em `connectionState/<name>` na Evolution;
 *   2. se 404 (instancia inexistente) ou erro → marca `close` + limpa JID;
 *   3. se estado real divergir do cache → atualiza o banco.
 *
 * O componente client continua responsavel por polling de QR e ações
 * manuais (provision/recreate/disconnect).
 */
export default async function AdminWhatsappPage() {
  const supabase = await createServerSupabase();
  const tenantId = await getCurrentTenantId();

  // Probe REAL na Evolution antes de qualquer render. Se a instancia
  // foi apagada por fora, isso ja corrige o banco e libera a UI pra
  // exibir "Desconectado" + botao de reconectar.
  // Erros no probe sao logados e absorvidos — UI mostra estado cacheado
  // como fallback (mas comecara a fazer polling pra retentar).
  await syncEvolutionStatus().catch((err) => {
    console.warn("[admin/whatsapp] syncEvolutionStatus falhou (continuando com cache)", {
      err: err instanceof Error ? err.message : String(err),
    });
  });

  const { data } = await supabase
    .from("tenants")
    .select(
      "evolution_instance_name, evolution_state, evolution_owner_jid, evolution_connected_at, evolution_webhook_set",
    )
    .eq("id", tenantId)
    .single();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-stone-900">WhatsApp</h1>
        <p className="text-sm text-stone-600">
          Conecte o WhatsApp da loja para receber pedidos automaticamente.
          Cada loja tem sua própria instância isolada.
        </p>
      </div>

      <WhatsappConnectCard
        initial={{
          evolution_instance_name: data?.evolution_instance_name ?? null,
          evolution_state: data?.evolution_state ?? null,
          evolution_owner_jid: data?.evolution_owner_jid ?? null,
          evolution_connected_at: data?.evolution_connected_at ?? null,
          evolution_webhook_set: data?.evolution_webhook_set ?? false,
        }}
      />
    </div>
  );
}
