-- 2026-09-12 — Completa colunas de pagamento em orders
-- O frontend (src/lib/actions/checkout.ts) e o webhook (src/app/api/webhooks/mercadopago/route.ts)
-- esperam várias colunas que ficaram de fora do schema inicial:
--   payment_status      -> enviado em todo INSERT do checkout
--   pix_qr_code, pix_qr_code_base64, pix_ticket_url -> preenchidos em /api/pagamentos/pix
--   payment_paid_at     -> preenchido pelo webhook quando aprovado (não confunde com paid_at
--                          que tinha sido chutado numa migração anterior)
--
-- Tudo idempotente (IF NOT EXISTS / DO block).

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_status_enum') THEN
    CREATE TYPE public.payment_status_enum AS ENUM ('pending', 'confirmed', 'failed');
  END IF;
END$$;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_status      public.payment_status_enum NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS payment_paid_at      timestamp with time zone,
  ADD COLUMN IF NOT EXISTS pix_qr_code          text,
  ADD COLUMN IF NOT EXISTS pix_qr_code_base64   text,
  ADD COLUMN IF NOT EXISTS pix_ticket_url       text;

-- Índice parcial pra reports de pedidos pagos vs pendentes.
CREATE INDEX IF NOT EXISTS orders_payment_status_idx
  ON public.orders (tenant_id, payment_status)
  WHERE payment_status IS NOT NULL;

-- Backfill: se já tem paid_at (da migração anterior) sem payment_paid_at, copia.
UPDATE public.orders
  SET payment_paid_at = paid_at
  WHERE paid_at IS NOT NULL AND payment_paid_at IS NULL;

-- paid_at foi nomenclatura provisória — agora padronizamos em payment_paid_at.
ALTER TABLE public.orders DROP COLUMN IF EXISTS paid_at;

COMMENT ON COLUMN public.orders.payment_status    IS 'pending (aguarda) | confirmed (Pix caiu) | failed (rejeitado/exp.)';
COMMENT ON COLUMN public.orders.payment_paid_at   IS 'Quando o provedor externo confirmou o pagamento';
COMMENT ON COLUMN public.orders.pix_qr_code       IS 'Payload copia-e-cola Pix gerado pelo MP';
COMMENT ON COLUMN public.orders.pix_qr_code_base64 IS 'QR code em PNG base64 pra exibir <img> no front';
COMMENT ON COLUMN public.orders.pix_ticket_url    IS 'URL do comprovante público no MP';
