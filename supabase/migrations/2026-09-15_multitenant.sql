-- ============================================================
-- Migration 001 — Multi-tenant hardening + tabela tables
-- Data: 2026-09-15
-- Idempotente: pode rodar quantas vezes quiser.
-- ============================================================

-- 1. Adicionar colunas faltantes em `tenants` (subdomain, owner_phone, owner_email, settings).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='tenants' AND column_name='subdomain') THEN
    ALTER TABLE public.tenants ADD COLUMN subdomain TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='tenants' AND column_name='owner_phone') THEN
    ALTER TABLE public.tenants ADD COLUMN owner_phone TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='tenants' AND column_name='owner_email') THEN
    ALTER TABLE public.tenants ADD COLUMN owner_email TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='tenants' AND column_name='settings') THEN
    ALTER TABLE public.tenants ADD COLUMN settings JSONB NOT NULL DEFAULT '{}'::jsonb;
  END IF;
END$$;

-- Backfill subdomain = slug onde estiver nulo.
UPDATE public.tenants SET subdomain = slug WHERE subdomain IS NULL;

-- UNIQUE constraint em subdomain (nullable mas unique quando preenchido).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='tenants_subdomain_key') THEN
    ALTER TABLE public.tenants ADD CONSTRAINT tenants_subdomain_key UNIQUE (subdomain);
  END IF;
END$$;

-- Backfill subdomain do Mendes a partir do host atual.
UPDATE public.tenants
   SET subdomain = 'mendes-teste.automacaojs.us'
 WHERE slug = 'mendes' AND (subdomain IS NULL OR subdomain = 'mendes');

-- 2. Promover o admin mais antigo do Mendes a role='owner' (já é o nível mais alto
-- do enum admin_role {owner,manager,staff}). Super admin global = role owner de
-- qualquer tenant é "dono" da empresa; o painel /super-admin vai checar isso.
DO $$
DECLARE
  v_admin_id UUID;
  v_count INTEGER;
BEGIN
  -- Se já existe algum admin com role='owner', não faz nada.
  SELECT count(*) INTO v_count FROM public.admins WHERE role = 'owner'::admin_role;
  IF v_count > 0 THEN
    RAISE NOTICE 'Já existe admin com role=owner; pulando promoção';
    RETURN;
  END IF;

  SELECT id INTO v_admin_id
    FROM public.admins
   WHERE tenant_id = '220d1df9-ec68-4e54-a72e-123d56bf0792'
   ORDER BY created_at ASC
   LIMIT 1;

  IF v_admin_id IS NOT NULL THEN
    UPDATE public.admins SET role = 'owner'::admin_role WHERE id = v_admin_id;
    RAISE NOTICE 'Admin % promovido a owner (super_admin global)', v_admin_id;
  ELSE
    RAISE NOTICE 'Nenhum admin no tenant Mendes; pulando';
  END IF;
END$$;

-- 3. Criar tabela `tables` (mesas físicas do salão).
CREATE TABLE IF NOT EXISTS public.tables (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  number      INTEGER NOT NULL CHECK (number > 0),
  label       TEXT,
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, number)
);

CREATE INDEX IF NOT EXISTS tables_tenant_active_idx
  ON public.tables (tenant_id) WHERE active = TRUE;

ALTER TABLE public.tables ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tables_public_select ON public.tables;
CREATE POLICY tables_public_select ON public.tables
  FOR SELECT
  USING (active = TRUE);
  -- Público lê mesas ativas (precisa pra resolver o QR Code ?mesa=N).
  -- Filtro por tenant é feito no app layer (Middleware injeta tenantId).

DROP POLICY IF EXISTS tables_admin_all ON public.tables;
CREATE POLICY tables_admin_all ON public.tables
  FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- 4. Sanidade final.
DO $$
DECLARE
  v_tenants_count INTEGER;
  v_tables_count INTEGER;
  v_mendes_subdomain TEXT;
  v_super_count INTEGER;
BEGIN
  SELECT count(*) INTO v_tenants_count FROM public.tenants;
  SELECT count(*) INTO v_tables_count FROM public.tables;
  SELECT subdomain INTO v_mendes_subdomain FROM public.tenants WHERE slug='mendes';
  SELECT count(*) INTO v_super_count FROM public.admins WHERE role = 'owner'::admin_role;
  RAISE NOTICE 'tenants: %, tables: %, mendes subdomain: %, super-admins: %',
    v_tenants_count, v_tables_count, v_mendes_subdomain, v_super_count;
END$$;
