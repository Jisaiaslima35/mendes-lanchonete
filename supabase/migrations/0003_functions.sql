-- ============================================================================
-- 0003_functions.sql — Funções de negócio
-- ============================================================================

-- ----------------------------------------------------------------------------
-- next_order_number: gera o próximo número sequencial do tenant de forma
-- atômica (update ... returning evita corrida entre pedidos simultâneos).
-- ----------------------------------------------------------------------------

create function next_order_number(p_tenant uuid) returns text as $$
declare
  v_prefix text;
  v_value int;
begin
  insert into order_counters (tenant_id, current_value)
  values (p_tenant, 0)
  on conflict (tenant_id) do nothing;

  update order_counters
  set current_value = current_value + 1
  where tenant_id = p_tenant
  returning current_value into v_value;

  select order_prefix into v_prefix from settings where tenant_id = p_tenant;

  return coalesce(v_prefix, '#') || lpad(v_value::text, 4, '0');
end;
$$ language plpgsql security definer set search_path = public;

-- ----------------------------------------------------------------------------
-- dashboard_metrics: métricas do painel para um intervalo de datas.
-- Pedidos cancelados ficam fora do faturamento e do ticket médio.
-- ----------------------------------------------------------------------------

create function dashboard_metrics(p_tenant uuid, p_from timestamptz, p_to timestamptz)
returns json as $$
  with valid_orders as (
    select * from orders
    where tenant_id = p_tenant
      and created_at >= p_from
      and created_at < p_to
      and status <> 'cancelado'
  ),
  by_status as (
    select status, count(*)::int as count
    from orders
    where tenant_id = p_tenant
      and created_at >= p_from
      and created_at < p_to
    group by status
  ),
  top_products as (
    select oi.product_name as name, sum(oi.quantity)::int as quantity
    from order_items oi
    join valid_orders o on o.id = oi.order_id
    group by oi.product_name
    order by quantity desc
    limit 5
  )
  select json_build_object(
    'orders_count', (select count(*) from valid_orders),
    'revenue', (select coalesce(sum(total), 0) from valid_orders),
    'avg_ticket', (select case when count(*) = 0 then 0 else round(sum(total) / count(*), 2) end from valid_orders),
    'by_status', (select coalesce(json_agg(by_status), '[]'::json) from by_status),
    'top_products', (select coalesce(json_agg(top_products), '[]'::json) from top_products)
  );
$$ language sql stable security definer set search_path = public;

grant execute on function next_order_number(uuid) to service_role, authenticated;
grant execute on function dashboard_metrics(uuid, timestamptz, timestamptz) to authenticated;
