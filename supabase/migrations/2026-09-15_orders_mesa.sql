-- 2026-09-15 — Adiciona modalidade "mesa" (consumo no local via QR Code)
-- Estende o enum fulfillment_type com o valor 'mesa' e cria a coluna
-- orders.mesa pra guardar o número/identificador da mesa quando
-- o cliente escaneia o QR e pede direto da mesa.
--
-- Fluxo:
--   QR Code da mesa → /cardapio?mesa=1 → checkout (sem endereço, R$ 0,00 entrega)
--   → INSERT em orders com fulfillment='mesa' e mesa='1'.
--
-- WhatsApp:
--   Na criação: NÃO dispara sendOrderToN8N (cliente tá na mesa, já vai chegar).
--   Quando admin move pra "Saiu p/ Entrega" (saiu_entrega): dispara n8n com
--   modality='mesa' e mesa='X' pra template "🍽 chegou na sua mesa".
--
-- Tudo idempotente — pode re-rodar sem erro.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'fulfillment_type' AND e.enumlabel = 'mesa'
  ) THEN
    ALTER TYPE public.fulfillment_type ADD VALUE 'mesa';
  END IF;
END$$;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS mesa text NULL;

COMMENT ON COLUMN public.orders.mesa IS
  'Identificador da mesa quando fulfillment=mesa (consumo no local via QR). NULL pra delivery/pickup.';

-- Índice simples pra relatórios de pedidos por mesa.
CREATE INDEX IF NOT EXISTS orders_mesa_idx
  ON public.orders (tenant_id, mesa)
  WHERE mesa IS NOT NULL;
