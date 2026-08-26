-- ============================================================================
-- reset.sql — Apaga tudo que as migrations criam, para recomeçar do zero.
-- Rode isto UMA VEZ antes de rodar 0001 a 0004 + seed novamente.
-- Seguro rodar mesmo se nada existir ainda.
-- ============================================================================

drop table if exists order_status_history cascade;
drop table if exists order_items cascade;
drop table if exists orders cascade;
drop table if exists order_counters cascade;
drop table if exists promotions cascade;
drop table if exists addresses cascade;
drop table if exists customers cascade;
drop table if exists neighborhoods cascade;
drop table if exists product_option_groups cascade;
drop table if exists options cascade;
drop table if exists option_groups cascade;
drop table if exists products cascade;
drop table if exists categories cascade;
drop table if exists admins cascade;
drop table if exists business_hours cascade;
drop table if exists settings cascade;
drop table if exists tenants cascade;

drop function if exists log_order_status() cascade;
drop function if exists set_updated_at() cascade;
drop function if exists is_admin() cascade;
drop function if exists next_order_number(uuid) cascade;
drop function if exists dashboard_metrics(uuid, timestamptz, timestamptz) cascade;

drop type if exists fulfillment_type cascade;
drop type if exists payment_method cascade;
drop type if exists order_status cascade;
drop type if exists selection_type cascade;
drop type if exists promotion_type cascade;
drop type if exists admin_role cascade;

delete from storage.buckets where id = 'midia';
