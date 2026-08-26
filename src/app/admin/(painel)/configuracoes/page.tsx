import { createServerSupabase } from "@/lib/supabase/server";
import { getCurrentTenantId } from "@/lib/tenant";
import { SettingsForm } from "@/components/admin/settings-form";
import type { BusinessHour, Settings } from "@/types/database";

export default async function AdminConfiguracoesPage() {
  const supabase = await createServerSupabase();
  const tenantId = await getCurrentTenantId();

  const [{ data: settings }, { data: hours }] = await Promise.all([
    supabase.from("settings").select("*").eq("tenant_id", tenantId).single(),
    supabase.from("business_hours").select("*").eq("tenant_id", tenantId).order("weekday"),
  ]);

  if (!settings) return <p className="text-red-600">Configurações não encontradas.</p>;

  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-xl font-bold text-stone-900">Configurações</h1>
      <SettingsForm settings={settings as unknown as Settings} hours={(hours ?? []) as unknown as BusinessHour[]} />
    </div>
  );
}
