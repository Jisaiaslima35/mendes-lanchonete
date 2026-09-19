-- 2026-09-18 — Pix Manual (BR Code / EMVCo Bacen) sem dependência do MercadoPago
-- Permite que o lojista receba Pix direto na chave dele. O servidor gera o payload
-- BR Code + QR base64 no momento do checkout, sem chamada externa. O admin confirma
-- o pagamento manualmente após ver o comprovante no WhatsApp da loja.

-- Tudo idempotente (IF NOT EXISTS / DO block) — pode rodar várias vezes sem erro.

-- 1. settings: dados BR Code por tenant ---------------------------------------

ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS pix_merchant_city varchar(80);

ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS pix_manual_enabled boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.settings.pix_merchant_city IS 'Cidade do recebedor — campo EMVCo 59 (obrigatório quando pix_manual_enabled)';
COMMENT ON COLUMN public.settings.pix_manual_enabled IS 'Toggle: usa BR Code local em vez do MercadoPago dinâmico';

-- 2. orders: identificar provider do pagamento --------------------------------

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_provider varchar(20);

COMMENT ON COLUMN public.orders.payment_provider IS 'mercadopago (dinâmico) | manual (BR Code gerado pelo servidor)';

-- Backfill: pedidos Pix antigos continuam sendo tratados como mercadopago
UPDATE public.orders
   SET payment_provider = 'mercadopago'
 WHERE payment_method = 'pix'
   AND payment_provider IS NULL;

-- 3. Seed Formiga: liga Pix Manual com placeholders. Isaías troca a chave via
--    /admin/configuracoes depois (CPF/CNPJ/email/celular reais).

UPDATE public.settings s
   SET pix_manual_enabled  = true,
       pix_merchant_city   = COALESCE(s.pix_merchant_city, 'Natal'),
       pix_beneficiary     = COALESCE(s.pix_beneficiary, 'Hot Dog do Formiga'),
       pix_receipt_message = COALESCE(
         s.pix_receipt_message,
         'Pagamento via Pix. Envie o comprovante pelo WhatsApp da loja.'
       )
  FROM public.tenants t
 WHERE s.tenant_id = t.id
   AND t.slug = 'formiga';

-- 4. Índice pra reports de pendências manuais (Kanban destaca)
CREATE INDEX IF NOT EXISTS orders_payment_provider_idx
  ON public.orders (tenant_id, payment_provider)
  WHERE payment_provider IS NOT NULL;
