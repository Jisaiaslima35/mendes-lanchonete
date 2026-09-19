-- ============================================================================
-- 2026-09-16_store_coords_pix.sql
-- Lote 1 de auditoria SaaS — itens 1 e 2.
--
-- 1. Coordenadas da loja por tenant (item 1):
--    Movemos STORE_LAT/STORE_LNG/STORE_CEP do .env (fixo, global) pra dentro
--    da tabela `settings` (1 linha por tenant). O cálculo Haversine agora
--    consulta a loja dona da requisição atual, com fallback seguro se o DB
--    estiver nulo.
--
-- 2. Dados Pix por tenant (item 2):
--    Já existia `pix_key` + `pix_key_type` por tenant. Adicionamos
--    `pix_beneficiary` (nome que aparece no app do banco) e
--    `pix_static_qr_base64` (QR estático pré-gerado pelo admin como
--    fallback caso o Pix dinâmico do MercadoPago falhe).
-- ============================================================================

alter table public.settings
  add column if not exists store_lat numeric(10,7),
  add column if not exists store_lng numeric(10,7),
  add column if not exists store_cep text,
  add column if not exists pix_beneficiary text,
  add column if not exists pix_static_qr_base64 text,
  add column if not exists pix_receipt_message text;

comment on column public.settings.store_lat is
  'Latitude da loja para cálculo de frete por distância (Haversine). Se nulo, frete cai pra FALLBACK_FEE.';
comment on column public.settings.store_lng is
  'Longitude da loja para cálculo de frete por distância (Haversine).';
comment on column public.settings.store_cep is
  'CEP da loja (8 dígitos, apenas números). Usado como origem do cálculo de distância.';
comment on column public.settings.pix_beneficiary is
  'Nome do recebedor que aparece no app do banco do cliente ao pagar Pix.';
comment on column public.settings.pix_static_qr_base64 is
  'QR Code Pix estático (PNG base64) cadastrado pelo admin. Fallback quando o Pix dinâmico do MercadoPago não está disponível.';
comment on column public.settings.pix_receipt_message is
  'Mensagem livre exibida ao cliente na página de pagamento Pix (ex: "Pagamento para X CNPJ Y").';

-- ----------------------------------------------------------------------------
-- Backfill: pegar STORE_LAT/LNG/CEP do env atual (.env.local) pra Mendes
-- (slug = mendes-teste, tenant_id 220d1df9-ec68-4e54-a72e-123d56bf0792).
-- Formiga fica null até o dono setar via /admin/configuracoes.
-- ----------------------------------------------------------------------------

update public.settings
   set store_lat  = -5.7058,
       store_lng  = -35.2974,
       store_cep  = '59135000'
 where tenant_id = '220d1df9-ec68-4e54-a72e-123d56bf0792'
   and store_lat is null;

-- Não quebra nada se o .env não tiver — a migration é idempotente e só
-- popula se a coluna estiver nula.
