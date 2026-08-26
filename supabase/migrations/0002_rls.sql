-- ============================================================================
-- 0002_rls.sql — Row Level Security
-- ============================================================================

-- ----------------------------------------------------------------------------
-- is_admin(): true se o usuário autenticado é um admin ativo.
-- security definer para poder ler `admins` mesmo antes de haver política nela.
-- ----------------------------------------------------------------------------

create function is_admin() returns boolean as $$
  select exists (
    select 1 from admins
    where admins.id = auth.uid() and admins.is_active = true
  );
$$ language sql stable security definer set search_path = public;

-- ----------------------------------------------------------------------------
-- Tabelas do catálogo: leitura pública (apenas ativos), escrita só admin.
-- ----------------------------------------------------------------------------

alter table tenants enable row level security;
alter table settings enable row level security;
alter table business_hours enable row level security;
alter table categories enable row level security;
alter table products enable row level security;
alter table option_groups enable row level security;
alter table options enable row level security;
alter table product_option_groups enable row level security;
alter table neighborhoods enable row level security;
alter table promotions enable row level security;
alter table admins enable row level security;
alter table customers enable row level security;
alter table addresses enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table order_status_history enable row level security;
alter table order_counters enable row level security;

-- tenants: leitura pública (necessário para resolver o tenant pelo slug)
create policy tenants_select_public on tenants
  for select using (is_active = true);
create policy tenants_admin_all on tenants
  for all using (is_admin()) with check (is_admin());

-- settings
create policy settings_select_public on settings
  for select using (true);
create policy settings_admin_all on settings
  for all using (is_admin()) with check (is_admin());

-- business_hours
create policy business_hours_select_public on business_hours
  for select using (true);
create policy business_hours_admin_all on business_hours
  for all using (is_admin()) with check (is_admin());

-- categories
create policy categories_select_public on categories
  for select using (is_active = true);
create policy categories_admin_all on categories
  for all using (is_admin()) with check (is_admin());

-- products
create policy products_select_public on products
  for select using (is_active = true);
create policy products_admin_all on products
  for all using (is_admin()) with check (is_admin());

-- option_groups
create policy option_groups_select_public on option_groups
  for select using (is_active = true);
create policy option_groups_admin_all on option_groups
  for all using (is_admin()) with check (is_admin());

-- options
create policy options_select_public on options
  for select using (is_available = true);
create policy options_admin_all on options
  for all using (is_admin()) with check (is_admin());

-- product_option_groups
create policy product_option_groups_select_public on product_option_groups
  for select using (true);
create policy product_option_groups_admin_all on product_option_groups
  for all using (is_admin()) with check (is_admin());

-- neighborhoods
create policy neighborhoods_select_public on neighborhoods
  for select using (is_active = true);
create policy neighborhoods_admin_all on neighborhoods
  for all using (is_admin()) with check (is_admin());

-- promotions
create policy promotions_select_public on promotions
  for select using (is_active = true);
create policy promotions_admin_all on promotions
  for all using (is_admin()) with check (is_admin());

-- ----------------------------------------------------------------------------
-- Tabelas sensíveis: sem acesso para anon. Somente admin (painel) e
-- service_role (Server Actions do checkout, que ignora RLS).
-- ----------------------------------------------------------------------------

create policy admins_self_select on admins
  for select using (id = auth.uid() or is_admin());
create policy admins_admin_write on admins
  for insert with check (is_admin());
create policy admins_admin_update on admins
  for update using (is_admin()) with check (is_admin());
create policy admins_admin_delete on admins
  for delete using (is_admin());

create policy customers_admin_all on customers
  for all using (is_admin()) with check (is_admin());

create policy addresses_admin_all on addresses
  for all using (is_admin()) with check (is_admin());

create policy orders_admin_all on orders
  for all using (is_admin()) with check (is_admin());

create policy order_items_admin_all on order_items
  for all using (is_admin()) with check (is_admin());

create policy order_status_history_admin_select on order_status_history
  for select using (is_admin());

create policy order_counters_admin_all on order_counters
  for all using (is_admin()) with check (is_admin());
