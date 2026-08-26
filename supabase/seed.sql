-- ============================================================================
-- seed.sql — Dados iniciais da Mendes Lanchonete e Padaria
-- Idempotente: pode ser rodado mais de uma vez sem duplicar registros.
-- ============================================================================

do $$
declare
  v_tenant_id uuid;
  v_cat_lanches uuid;
  v_cat_pasteis uuid;
  v_cat_porcoes uuid;
  v_cat_bebidas uuid;
  v_cat_combos uuid;
  v_cat_padaria uuid;
  v_group_tamanho uuid;
  v_group_adicionais uuid;
  v_product_xbacon uuid;
  v_product_xsalada uuid;
  v_weekday int;
begin
  -- Tenant --------------------------------------------------------------
  insert into tenants (name, slug)
  values ('Mendes Lanchonete e Padaria', 'mendes')
  on conflict (slug) do update set name = excluded.name
  returning id into v_tenant_id;

  -- Settings --------------------------------------------------------------
  insert into settings (
    tenant_id, business_name, whatsapp_number, phone,
    address_street, address_number, address_district, address_city, address_state, address_zip,
    avg_delivery_minutes, avg_pickup_minutes, min_order_value, free_delivery_threshold
  )
  values (
    v_tenant_id, 'Mendes Lanchonete e Padaria', '5511999999999', '(11) 99999-9999',
    'Rua das Flores', '123', 'Centro', 'São Paulo', 'SP', '01000-000',
    40, 20, 15.00, 60.00
  )
  on conflict (tenant_id) do nothing;

  -- Horário de funcionamento (terça a domingo, 18h-23h; segunda fechado) --
  delete from business_hours where tenant_id = v_tenant_id;
  for v_weekday in 0..6 loop
    if v_weekday = 1 then
      insert into business_hours (tenant_id, weekday, opens_at, closes_at, is_closed)
      values (v_tenant_id, v_weekday, '00:00', '00:00', true);
    else
      insert into business_hours (tenant_id, weekday, opens_at, closes_at, is_closed)
      values (v_tenant_id, v_weekday, '18:00', '23:00', false);
    end if;
  end loop;

  -- Categorias --------------------------------------------------------------
  insert into categories (tenant_id, name, slug, sort_order)
  values (v_tenant_id, 'Lanches', 'lanches', 1)
  on conflict (tenant_id, slug) do update set sort_order = excluded.sort_order
  returning id into v_cat_lanches;

  insert into categories (tenant_id, name, slug, sort_order)
  values (v_tenant_id, 'Pastéis', 'pasteis', 2)
  on conflict (tenant_id, slug) do update set sort_order = excluded.sort_order
  returning id into v_cat_pasteis;

  insert into categories (tenant_id, name, slug, sort_order)
  values (v_tenant_id, 'Porções', 'porcoes', 3)
  on conflict (tenant_id, slug) do update set sort_order = excluded.sort_order
  returning id into v_cat_porcoes;

  insert into categories (tenant_id, name, slug, sort_order)
  values (v_tenant_id, 'Bebidas', 'bebidas', 4)
  on conflict (tenant_id, slug) do update set sort_order = excluded.sort_order
  returning id into v_cat_bebidas;

  insert into categories (tenant_id, name, slug, sort_order)
  values (v_tenant_id, 'Combos', 'combos', 5)
  on conflict (tenant_id, slug) do update set sort_order = excluded.sort_order
  returning id into v_cat_combos;

  insert into categories (tenant_id, name, slug, sort_order)
  values (v_tenant_id, 'Padaria', 'padaria', 6)
  on conflict (tenant_id, slug) do update set sort_order = excluded.sort_order
  returning id into v_cat_padaria;

  -- Grupos de opções --------------------------------------------------------
  insert into option_groups (tenant_id, name, selection_type, min_select, max_select, is_required, sort_order)
  values (v_tenant_id, 'Tamanho', 'single', 1, 1, true, 1)
  on conflict (tenant_id, name) do update set sort_order = excluded.sort_order
  returning id into v_group_tamanho;

  insert into options (group_id, name, price_delta, sort_order) values
    (v_group_tamanho, 'Tradicional', 0, 1),
    (v_group_tamanho, 'Grande', 6.00, 2)
  on conflict (group_id, name) do update set price_delta = excluded.price_delta;

  insert into option_groups (tenant_id, name, selection_type, min_select, max_select, is_required, sort_order)
  values (v_tenant_id, 'Adicionais', 'multiple', 0, 5, false, 2)
  on conflict (tenant_id, name) do update set sort_order = excluded.sort_order
  returning id into v_group_adicionais;

  insert into options (group_id, name, price_delta, sort_order) values
    (v_group_adicionais, 'Bacon extra', 4.00, 1),
    (v_group_adicionais, 'Ovo', 2.00, 2),
    (v_group_adicionais, 'Cheddar', 3.00, 3),
    (v_group_adicionais, 'Hambúrguer extra', 7.00, 4)
  on conflict (group_id, name) do update set price_delta = excluded.price_delta;

  -- Produtos ------------------------------------------------------------
  insert into products (tenant_id, category_id, name, slug, description, price, promo_price, is_featured, prep_minutes, sort_order)
  values (v_tenant_id, v_cat_lanches, 'X-Bacon', 'x-bacon', 'Pão, hambúrguer, queijo, bacon, alface e tomate.', 22.00, null, true, 20, 1)
  on conflict (tenant_id, slug) do update set price = excluded.price
  returning id into v_product_xbacon;

  insert into product_option_groups (product_id, group_id, sort_order) values
    (v_product_xbacon, v_group_tamanho, 1), (v_product_xbacon, v_group_adicionais, 2)
  on conflict (product_id, group_id) do nothing;

  insert into products (tenant_id, category_id, name, slug, description, price, promo_price, is_featured, prep_minutes, sort_order)
  values (v_tenant_id, v_cat_lanches, 'X-Salada', 'x-salada', 'Pão, hambúrguer, queijo, alface, tomate e maionese.', 18.00, 15.00, true, 18, 2)
  on conflict (tenant_id, slug) do update set price = excluded.price
  returning id into v_product_xsalada;

  insert into product_option_groups (product_id, group_id, sort_order) values
    (v_product_xsalada, v_group_tamanho, 1), (v_product_xsalada, v_group_adicionais, 2)
  on conflict (product_id, group_id) do nothing;

  insert into products (tenant_id, category_id, name, slug, description, price, is_featured, prep_minutes, sort_order)
  values (v_tenant_id, v_cat_pasteis, 'Pastel de Carne', 'pastel-de-carne', 'Massa crocante recheada com carne moída temperada.', 9.00, false, 12, 1)
  on conflict (tenant_id, slug) do update set price = excluded.price;

  insert into products (tenant_id, category_id, name, slug, description, price, is_featured, prep_minutes, sort_order)
  values (v_tenant_id, v_cat_pasteis, 'Pastel de Queijo', 'pastel-de-queijo', 'Massa crocante recheada com queijo derretido.', 8.00, false, 12, 2)
  on conflict (tenant_id, slug) do update set price = excluded.price;

  insert into products (tenant_id, category_id, name, slug, description, price, is_featured, prep_minutes, sort_order)
  values (v_tenant_id, v_cat_porcoes, 'Batata Frita', 'batata-frita', 'Porção generosa de batata frita crocante.', 20.00, true, 15, 1)
  on conflict (tenant_id, slug) do update set price = excluded.price;

  insert into products (tenant_id, category_id, name, slug, description, price, is_featured, prep_minutes, sort_order)
  values (v_tenant_id, v_cat_bebidas, 'Refrigerante Lata', 'refrigerante-lata', 'Lata 350ml — diversos sabores.', 6.00, false, 1, 1)
  on conflict (tenant_id, slug) do update set price = excluded.price;

  insert into products (tenant_id, category_id, name, slug, description, price, is_featured, prep_minutes, sort_order)
  values (v_tenant_id, v_cat_bebidas, 'Suco Natural', 'suco-natural', 'Copo 500ml, feito na hora.', 9.00, false, 5, 2)
  on conflict (tenant_id, slug) do update set price = excluded.price;

  insert into products (tenant_id, category_id, name, slug, description, price, promo_price, is_featured, prep_minutes, sort_order)
  values (v_tenant_id, v_cat_combos, 'Combo X-Bacon', 'combo-x-bacon', 'X-Bacon + batata frita + refrigerante lata.', 38.00, 32.00, true, 20, 1)
  on conflict (tenant_id, slug) do update set price = excluded.price;

  insert into products (tenant_id, category_id, name, slug, description, price, is_featured, prep_minutes, sort_order)
  values (v_tenant_id, v_cat_padaria, 'Pão Francês (unidade)', 'pao-frances', 'Fresquinho, assado no dia.', 0.90, false, 1, 1)
  on conflict (tenant_id, slug) do update set price = excluded.price;

  insert into products (tenant_id, category_id, name, slug, description, price, is_featured, prep_minutes, sort_order)
  values (v_tenant_id, v_cat_padaria, 'Pão de Queijo (unidade)', 'pao-de-queijo', 'Feito com queijo de verdade.', 4.50, false, 1, 2)
  on conflict (tenant_id, slug) do update set price = excluded.price;

  -- Bairros ------------------------------------------------------------
  insert into neighborhoods (tenant_id, name, city, delivery_fee, min_order_value, estimated_minutes)
  values
    (v_tenant_id, 'Centro', 'São Paulo', 5.00, 15.00, 35),
    (v_tenant_id, 'Jardim das Flores', 'São Paulo', 8.00, 15.00, 45),
    (v_tenant_id, 'Vila Nova', 'São Paulo', 7.00, 15.00, 40)
  on conflict (tenant_id, name) do update set delivery_fee = excluded.delivery_fee;

  -- Promoção de exemplo (banner) --------------------------------------------
  delete from promotions where tenant_id = v_tenant_id and type = 'banner';
  insert into promotions (tenant_id, title, description, type, value, is_active, sort_order)
  values (v_tenant_id, 'Combo X-Bacon com desconto', 'Combo completo por um preço especial.', 'banner', 0, true, 1);

end $$;
