-- ============================================================================
-- 2026-09-16_is_admin_scoped.sql
-- Lote 1 de auditoria SaaS — item 4.
--
-- HOJE: `is_admin()` retorna true se o usuário tem QUALQUER registro ativo
--       em `admins`. Combinado com a policy `orders_admin_all using (is_admin())`,
--       isso permite que um admin de loja A leia/edite pedidos da loja B.
--       Vazamento entre tenants.
--
-- FIX: introduzir `is_admin_for_tenant(p_tenant uuid)` que checa
--      `admins.tenant_id = p_tenant`. Atualizar policies de tabelas
--      tenant-scoped (orders, order_items, order_status_history, customers,
--      addresses) pra usar a versão scoped. Tabelas SaaS-level (tenants,
--      admins, settings do próprio tenant) continuam usando `is_admin()`
--      puro — essas precisam ser cross-tenant pro Isaías (super-admin).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Helper scoped por tenant.
-- security definer pra poder ler `admins` antes da RLS de admins existir.
-- ----------------------------------------------------------------------------

create or replace function public.is_admin_for_tenant(p_tenant uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admins
    where admins.id = auth.uid()
      and admins.tenant_id = p_tenant
      and admins.is_active = true
  );
$$;

comment on function public.is_admin_for_tenant(uuid) is
  'True se o usuário autenticado é admin ATIVO do tenant p_tenant. Usado nas policies de tabelas com tenant_id.';

-- ----------------------------------------------------------------------------
-- Atualizar policies de tabelas tenant-scoped.
--
-- Drop + recreate (mesma estrutura, USING/WITH CHECK trocados pra
-- is_admin_for_tenant(<coluna_tenant_id>)).
-- ----------------------------------------------------------------------------

-- orders
drop policy if exists orders_admin_all on public.orders;
create policy orders_admin_all on public.orders
  for all
  using      (public.is_admin_for_tenant(tenant_id))
  with check (public.is_admin_for_tenant(tenant_id));

-- order_items (sem tenant_id direto — herda via orders)
drop policy if exists order_items_admin_all on public.order_items;
create policy order_items_admin_all on public.order_items
  for all
  using      (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id
        and public.is_admin_for_tenant(o.tenant_id)
    )
  )
  with check (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id
        and public.is_admin_for_tenant(o.tenant_id)
    )
  );

-- order_status_history (também sem tenant_id direto)
drop policy if exists order_status_history_admin_select on public.order_status_history;
create policy order_status_history_admin_select on public.order_status_history
  for select
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_status_history.order_id
        and public.is_admin_for_tenant(o.tenant_id)
    )
  );

-- customers
drop policy if exists customers_admin_all on public.customers;
create policy customers_admin_all on public.customers
  for all
  using      (public.is_admin_for_tenant(tenant_id))
  with check (public.is_admin_for_tenant(tenant_id));

-- addresses (sem tenant_id — liga via customers)
drop policy if exists addresses_admin_all on public.addresses;
create policy addresses_admin_all on public.addresses
  for all
  using      (
    exists (
      select 1 from public.customers c
      where c.id = addresses.customer_id
        and public.is_admin_for_tenant(c.tenant_id)
    )
  )
  with check (
    exists (
      select 1 from public.customers c
      where c.id = addresses.customer_id
        and public.is_admin_for_tenant(c.tenant_id)
    )
  );

-- ----------------------------------------------------------------------------
-- `is_admin()` original INTACTO.
-- Continua sendo usado pelas policies SaaS-level (tenants, settings,
-- admins, categories, products, etc.) — onde o super-admin (Isaías)
-- precisa ver/editar TODOS os tenants.
-- ============================================================================
