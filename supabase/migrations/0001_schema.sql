-- ============================================================================
-- 0001_schema.sql — Enums, tabelas, índices e triggers
-- ============================================================================

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- Enums
-- ----------------------------------------------------------------------------

create type fulfillment_type as enum ('delivery', 'pickup');
create type payment_method as enum ('pix', 'cash', 'card');
create type order_status as enum (
  'novo', 'confirmado', 'em_preparo', 'pronto', 'saiu_entrega', 'entregue', 'cancelado'
);
create type selection_type as enum ('single', 'multiple');
create type promotion_type as enum ('percent', 'fixed', 'free_delivery', 'banner');
create type admin_role as enum ('owner', 'manager', 'staff');

-- ----------------------------------------------------------------------------
-- Trigger genérico: updated_at
-- ----------------------------------------------------------------------------

create function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ----------------------------------------------------------------------------
-- tenants
-- ----------------------------------------------------------------------------

create table tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- settings (1 linha por tenant)
-- ----------------------------------------------------------------------------

create table settings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null unique references tenants(id) on delete cascade,

  business_name text not null default 'Mendes Lanchonete e Padaria',
  logo_url text,
  banner_url text,
  primary_color text not null default '#dc2626',
  accent_color text not null default '#facc15',

  whatsapp_number text not null default '',
  phone text,
  instagram_url text,
  facebook_url text,
  maps_url text,

  address_street text,
  address_number text,
  address_complement text,
  address_district text,
  address_city text,
  address_state text,
  address_zip text,

  avg_delivery_minutes int not null default 40,
  avg_pickup_minutes int not null default 20,
  min_order_value numeric(10,2) not null default 0,
  free_delivery_threshold numeric(10,2),
  accepts_delivery boolean not null default true,
  accepts_pickup boolean not null default true,
  manual_closed boolean not null default false,
  closed_message text not null default 'Estamos fechados no momento.',

  payment_pix boolean not null default true,
  payment_cash boolean not null default true,
  payment_card boolean not null default true,
  pix_key text,
  pix_key_type text,

  order_prefix text not null default '#',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger settings_set_updated_at
  before update on settings
  for each row execute function set_updated_at();

-- ----------------------------------------------------------------------------
-- business_hours
-- ----------------------------------------------------------------------------

create table business_hours (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  opens_at time not null,
  closes_at time not null,
  is_closed boolean not null default false,
  created_at timestamptz not null default now()
);

create index business_hours_tenant_idx on business_hours(tenant_id, weekday);

-- ----------------------------------------------------------------------------
-- admins
-- ----------------------------------------------------------------------------

create table admins (
  id uuid primary key references auth.users(id) on delete cascade,
  tenant_id uuid not null references tenants(id) on delete cascade,
  name text not null,
  email text not null,
  role admin_role not null default 'staff',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index admins_tenant_idx on admins(tenant_id);

-- ----------------------------------------------------------------------------
-- categories
-- ----------------------------------------------------------------------------

create table categories (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  name text not null,
  slug text not null,
  description text,
  image_url text,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, slug)
);

create index categories_tenant_idx on categories(tenant_id, sort_order);

create trigger categories_set_updated_at
  before update on categories
  for each row execute function set_updated_at();

-- ----------------------------------------------------------------------------
-- products
-- ----------------------------------------------------------------------------

create table products (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  category_id uuid not null references categories(id) on delete restrict,
  name text not null,
  slug text not null,
  description text,
  price numeric(10,2) not null check (price >= 0),
  promo_price numeric(10,2) check (promo_price is null or promo_price >= 0),
  image_url text,
  is_featured boolean not null default false,
  is_available boolean not null default true,
  prep_minutes int not null default 15,
  sort_order int not null default 0,
  is_active boolean not null default true,
  sold_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, slug),
  constraint promo_price_lower_than_price check (promo_price is null or promo_price < price)
);

create index products_tenant_idx on products(tenant_id, is_active);
create index products_category_idx on products(category_id);
create index products_featured_idx on products(tenant_id, is_featured) where is_featured;

create trigger products_set_updated_at
  before update on products
  for each row execute function set_updated_at();

-- ----------------------------------------------------------------------------
-- option_groups / options / product_option_groups
-- ----------------------------------------------------------------------------

create table option_groups (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  name text not null,
  description text,
  selection_type selection_type not null default 'single',
  min_select int not null default 0,
  max_select int,
  is_required boolean not null default false,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, name)
);

create trigger option_groups_set_updated_at
  before update on option_groups
  for each row execute function set_updated_at();

create table options (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references option_groups(id) on delete cascade,
  name text not null,
  price_delta numeric(10,2) not null default 0,
  is_available boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (group_id, name)
);

create index options_group_idx on options(group_id, sort_order);

create trigger options_set_updated_at
  before update on options
  for each row execute function set_updated_at();

create table product_option_groups (
  product_id uuid not null references products(id) on delete cascade,
  group_id uuid not null references option_groups(id) on delete cascade,
  sort_order int not null default 0,
  primary key (product_id, group_id)
);

create index product_option_groups_group_idx on product_option_groups(group_id);

-- ----------------------------------------------------------------------------
-- neighborhoods (bairros)
-- ----------------------------------------------------------------------------

create table neighborhoods (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  name text not null,
  city text,
  delivery_fee numeric(10,2) not null default 0,
  min_order_value numeric(10,2) not null default 0,
  free_delivery_threshold numeric(10,2),
  estimated_minutes int not null default 40,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, name)
);

create index neighborhoods_tenant_idx on neighborhoods(tenant_id, is_active);

create trigger neighborhoods_set_updated_at
  before update on neighborhoods
  for each row execute function set_updated_at();

-- ----------------------------------------------------------------------------
-- customers / addresses
-- ----------------------------------------------------------------------------

create table customers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  name text not null,
  phone text not null,
  email text,
  notes text,
  orders_count int not null default 0,
  total_spent numeric(10,2) not null default 0,
  last_order_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, phone)
);

create index customers_tenant_idx on customers(tenant_id);

create trigger customers_set_updated_at
  before update on customers
  for each row execute function set_updated_at();

create table addresses (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete cascade,
  neighborhood_id uuid references neighborhoods(id) on delete set null,
  zip text,
  street text not null,
  number text not null,
  complement text,
  district text not null,
  reference text,
  city text,
  state text,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

create index addresses_customer_idx on addresses(customer_id);

-- ----------------------------------------------------------------------------
-- promotions
-- ----------------------------------------------------------------------------

create table promotions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  title text not null,
  description text,
  image_url text,
  type promotion_type not null default 'banner',
  value numeric(10,2) not null default 0,
  coupon_code text,
  min_order_value numeric(10,2) not null default 0,
  starts_at timestamptz,
  ends_at timestamptz,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index promotions_tenant_idx on promotions(tenant_id, is_active);
create unique index promotions_coupon_idx on promotions(tenant_id, coupon_code) where coupon_code is not null;

create trigger promotions_set_updated_at
  before update on promotions
  for each row execute function set_updated_at();

-- ----------------------------------------------------------------------------
-- order_counters (suporte a next_order_number, ver 0003_functions.sql)
-- ----------------------------------------------------------------------------

create table order_counters (
  tenant_id uuid primary key references tenants(id) on delete cascade,
  current_value int not null default 0
);

-- ----------------------------------------------------------------------------
-- orders / order_items / order_status_history
-- ----------------------------------------------------------------------------

create table orders (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete restrict,
  order_number text not null,
  public_token text not null unique default encode(gen_random_bytes(16), 'hex'),

  customer_id uuid references customers(id) on delete set null,
  customer_name text not null,
  customer_phone text not null,

  fulfillment fulfillment_type not null,

  address_zip text,
  address_street text,
  address_number text,
  address_complement text,
  address_district text,
  address_reference text,
  neighborhood_id uuid references neighborhoods(id) on delete set null,
  neighborhood_name text,

  payment_method payment_method not null,
  change_for numeric(10,2),

  items_total numeric(10,2) not null default 0,
  delivery_fee numeric(10,2) not null default 0,
  discount numeric(10,2) not null default 0,
  total numeric(10,2) not null default 0,
  coupon_code text,
  notes text,

  status order_status not null default 'novo',
  status_updated_at timestamptz not null default now(),
  whatsapp_sent boolean not null default false,

  created_at timestamptz not null default now(),
  unique (tenant_id, order_number)
);

create index orders_tenant_idx on orders(tenant_id, created_at desc);
create index orders_status_idx on orders(tenant_id, status);
create index orders_customer_idx on orders(customer_id);

create table order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  product_id uuid references products(id) on delete set null,
  product_name text not null,
  unit_price numeric(10,2) not null,
  quantity int not null check (quantity > 0),
  options jsonb not null default '[]'::jsonb,
  options_total numeric(10,2) not null default 0,
  notes text,
  line_total numeric(10,2) not null,
  created_at timestamptz not null default now()
);

create index order_items_order_idx on order_items(order_id);

create table order_status_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  status order_status not null,
  changed_by uuid references auth.users(id) on delete set null,
  changed_at timestamptz not null default now()
);

create index order_status_history_order_idx on order_status_history(order_id, changed_at);

create function log_order_status() returns trigger as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    insert into order_status_history (order_id, status, changed_by)
    values (new.id, new.status, auth.uid());
    new.status_updated_at = now();
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger orders_log_status
  before insert or update of status on orders
  for each row execute function log_order_status();
