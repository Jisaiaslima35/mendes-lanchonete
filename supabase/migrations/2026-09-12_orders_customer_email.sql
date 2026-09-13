-- 2026-09-12 — Adiciona coluna customer_email em orders
-- O INSERT do checkout mandava customer_email mas o schema original não tinha —
-- falha PostgREST "PGRST204 Could not find the 'customer_email' column".
-- TS types em src/types/database.ts já esperam o campo, então basta materializar no DB.
-- Nullable pra manter compatibilidade com pedidos antigos.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS customer_email text;

CREATE INDEX IF NOT EXISTS orders_customer_email_idx
  ON public.orders (customer_email)
  WHERE customer_email IS NOT NULL;

COMMENT ON COLUMN public.orders.customer_email IS 'Email do cliente — útil pra confirmação + correlação MP';
