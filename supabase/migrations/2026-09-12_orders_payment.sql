-- 2026-09-12 — Adiciona colunas de pagamento Pix na tabela orders
-- Necessário para o webhook do MercadoPago persistir rastreabilidade de pagamento
-- e para o /api/pagamentos/pix deixar de ser um UPDATE silencioso (sem essas colunas,
-- o UPDATE rodava mas não persistia nada — bug latente corrigido junto).
--
-- Idempotente (IF NOT EXISTS) — pode rodar quantas vezes quiser sem erro.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_provider             text,
  ADD COLUMN IF NOT EXISTS payment_transaction_id      text,
  ADD COLUMN IF NOT EXISTS paid_at                      timestamp with time zone,
  ADD COLUMN IF NOT EXISTS paid_amount                  numeric;

-- Index para o webhook buscar pedido por payment_transaction_id em O(log n) caso
-- a relação external_reference venha vazia.
CREATE INDEX IF NOT EXISTS orders_payment_transaction_id_idx
  ON public.orders (payment_transaction_id)
  WHERE payment_transaction_id IS NOT NULL;

COMMENT ON COLUMN public.orders.payment_provider        IS 'mercadopago | manual | …';
COMMENT ON COLUMN public.orders.payment_transaction_id IS 'ID do pagamento na plataforma externa (MP, Stone, etc)';
COMMENT ON COLUMN public.orders.paid_at                 IS 'Quando o pagamento foi confirmado pelo provedor';
COMMENT ON COLUMN public.orders.paid_amount             IS 'Valor efetivamente confirmado pelo provedor (em reais)';
