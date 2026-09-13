-- 2026-09-12 — Fix: trigger orders_log_status precisa ser AFTER, não BEFORE
-- O INSERT em orders falhava silenciosamente com FK violation em order_status_history
-- porque a trigger BEFORE INSERT chamava insert com new.id NULL (a coluna id tem
-- default gen_random_uuid() preenchido DEPOIS das triggers BEFORE em Postgres).
-- Sintoma: checkout retornava 'pedido não registrado' sem log útil.
--
-- Solução: recriar como AFTER INSERT OR UPDATE OF status, que roda com new.id já
-- preenchido. A função log_order_status() em si tá OK — só precisa de AFTER.

DROP TRIGGER IF EXISTS orders_log_status ON public.orders;

CREATE TRIGGER orders_log_status
  AFTER INSERT OR UPDATE OF status ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.log_order_status();
