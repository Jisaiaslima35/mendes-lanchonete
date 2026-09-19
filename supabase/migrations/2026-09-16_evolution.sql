-- Evolution API WhatsApp integration per tenant (msg 4791).
-- Cada tenant tem sua propria instancia na Evolution API, nomeada pelo slug.
-- Colunas abaixo cacheiam o estado da instancia localmente pra evitar
-- bater na API externa a cada page load do admin.
--
-- Idempotente: rodar varias vezes produz o mesmo estado final.

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS evolution_instance_name text,
  ADD COLUMN IF NOT EXISTS evolution_state text,
  ADD COLUMN IF NOT EXISTS evolution_owner_jid text,
  ADD COLUMN IF NOT EXISTS evolution_connected_at timestamptz,
  ADD COLUMN IF NOT EXISTS evolution_webhook_set boolean NOT NULL DEFAULT false;

-- Backfill: instance_name default = slug (regra do plano).
UPDATE public.tenants
  SET evolution_instance_name = slug
  WHERE evolution_instance_name IS NULL;
