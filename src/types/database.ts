/**
 * Tipos do schema Supabase, escritos a mao a partir de
 * supabase/migrations/0001_schema.sql. Manter em sincronia com as migrations.
 */

export type FulfillmentType = "delivery" | "pickup";
export type PaymentMethod = "pix" | "cash" | "card";
export type OrderStatus =
  | "novo"
  | "confirmado"
  | "em_preparo"
  | "pronto"
  | "saiu_entrega"
  | "entregue"
  | "cancelado";
export type SelectionType = "single" | "multiple";
export type PromotionType = "percent" | "fixed" | "free_delivery" | "banner";
export type AdminRole = "owner" | "manager" | "staff";

interface TenantRow {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
  created_at: string;
}

interface SettingsRow {
  id: string;
  tenant_id: string;
  business_name: string;
  logo_url: string | null;
  banner_url: string | null;
  primary_color: string;
  accent_color: string;
  whatsapp_number: string;
  phone: string | null;
  instagram_url: string | null;
  facebook_url: string | null;
  maps_url: string | null;
  address_street: string | null;
  address_number: string | null;
  address_complement: string | null;
  address_district: string | null;
  address_city: string | null;
  address_state: string | null;
  address_zip: string | null;
  avg_delivery_minutes: number;
  avg_pickup_minutes: number;
  min_order_value: number;
  free_delivery_threshold: number | null;
  accepts_delivery: boolean;
  accepts_pickup: boolean;
  manual_closed: boolean;
  closed_message: string;
  payment_pix: boolean;
  payment_cash: boolean;
  payment_card: boolean;
  pix_key: string | null;
  pix_key_type: string | null;
  order_prefix: string;
  created_at: string;
  updated_at: string;
}

interface BusinessHourRow {
  id: string;
  tenant_id: string;
  weekday: number;
  opens_at: string;
  closes_at: string;
  is_closed: boolean;
  created_at: string;
}

interface AdminRow {
  id: string;
  tenant_id: string;
  name: string;
  email: string;
  role: AdminRole;
  is_active: boolean;
  created_at: string;
}

interface CategoryRow {
  id: string;
  tenant_id: string;
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface ProductRow {
  id: string;
  tenant_id: string;
  category_id: string;
  name: string;
  slug: string;
  description: string | null;
  price: number;
  promo_price: number | null;
  image_url: string | null;
  is_featured: boolean;
  is_available: boolean;
  prep_minutes: number;
  sort_order: number;
  is_active: boolean;
  sold_count: number;
  created_at: string;
  updated_at: string;
}

interface OptionGroupRow {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  selection_type: SelectionType;
  min_select: number;
  max_select: number | null;
  is_required: boolean;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface ProductOptionRow {
  id: string;
  group_id: string;
  name: string;
  price_delta: number;
  is_available: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

interface ProductOptionGroupLinkRow {
  product_id: string;
  group_id: string;
  sort_order: number;
}

interface NeighborhoodRow {
  id: string;
  tenant_id: string;
  name: string;
  city: string | null;
  delivery_fee: number;
  min_order_value: number;
  free_delivery_threshold: number | null;
  estimated_minutes: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface CustomerRow {
  id: string;
  tenant_id: string;
  name: string;
  phone: string;
  email: string | null;
  notes: string | null;
  orders_count: number;
  total_spent: number;
  last_order_at: string | null;
  created_at: string;
  updated_at: string;
}

interface AddressRow {
  id: string;
  customer_id: string;
  neighborhood_id: string | null;
  zip: string | null;
  street: string;
  number: string;
  complement: string | null;
  district: string;
  reference: string | null;
  city: string | null;
  state: string | null;
  is_default: boolean;
  created_at: string;
}

interface PromotionRow {
  id: string;
  tenant_id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  type: PromotionType;
  value: number;
  coupon_code: string | null;
  min_order_value: number;
  starts_at: string | null;
  ends_at: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

interface OrderCounterRow {
  tenant_id: string;
  current_value: number;
}

interface OrderRow {
  id: string;
  tenant_id: string;
  order_number: string;
  public_token: string;
  customer_id: string | null;
  customer_name: string;
  customer_phone: string;
  fulfillment: FulfillmentType;
  address_zip: string | null;
  address_street: string | null;
  address_number: string | null;
  address_complement: string | null;
  address_district: string | null;
  address_reference: string | null;
  neighborhood_id: string | null;
  neighborhood_name: string | null;
  payment_method: PaymentMethod;
payment_status: "pending" | "confirmed" | "failed";
change_for: number | null;
  items_total: number;
  delivery_fee: number;
  discount: number;
  total: number;
  coupon_code: string | null;
  notes: string | null;
  status: OrderStatus;
  status_updated_at: string;
  whatsapp_sent: boolean;
  created_at: string;
}

interface OrderItemRow {
  id: string;
  order_id: string;
  product_id: string | null;
  product_name: string;
  unit_price: number;
  quantity: number;
  options: { groupName: string; optionName: string; priceDelta: number }[];
  options_total: number;
  notes: string | null;
  line_total: number;
  created_at: string;
}

interface OrderStatusHistoryRow {
  id: string;
  order_id: string;
  status: OrderStatus;
  changed_by: string | null;
  changed_at: string;
}

export interface Database {
  public: {
    Tables: {
      tenants: {
        Row: TenantRow;
        Insert: Partial<TenantRow> & { name: string; slug: string };
        Update: Partial<TenantRow>;
        Relationships: [];
      };
      settings: {
        Row: SettingsRow;
        Insert: Partial<SettingsRow> & { tenant_id: string };
        Update: Partial<SettingsRow>;
        Relationships: [];
      };
      business_hours: {
        Row: BusinessHourRow;
        Insert: Partial<BusinessHourRow> & {
          tenant_id: string;
          weekday: number;
          opens_at: string;
          closes_at: string;
        };
        Update: Partial<BusinessHourRow>;
        Relationships: [];
      };
      admins: {
        Row: AdminRow;
        Insert: Partial<AdminRow> & { id: string; tenant_id: string; name: string; email: string };
        Update: Partial<AdminRow>;
        Relationships: [];
      };
      categories: {
        Row: CategoryRow;
        Insert: Partial<CategoryRow> & { tenant_id: string; name: string; slug: string };
        Update: Partial<CategoryRow>;
        Relationships: [];
      };
      products: {
        Row: ProductRow;
        Insert: Partial<ProductRow> & {
          tenant_id: string;
          category_id: string;
          name: string;
          slug: string;
          price: number;
        };
        Update: Partial<ProductRow>;
        Relationships: [];
      };
      option_groups: {
        Row: OptionGroupRow;
        Insert: Partial<OptionGroupRow> & { tenant_id: string; name: string };
        Update: Partial<OptionGroupRow>;
        Relationships: [];
      };
      options: {
        Row: ProductOptionRow;
        Insert: Partial<ProductOptionRow> & { group_id: string; name: string };
        Update: Partial<ProductOptionRow>;
        Relationships: [];
      };
      product_option_groups: {
        Row: ProductOptionGroupLinkRow;
        Insert: ProductOptionGroupLinkRow;
        Update: Partial<ProductOptionGroupLinkRow>;
        Relationships: [];
      };
      neighborhoods: {
        Row: NeighborhoodRow;
        Insert: Partial<NeighborhoodRow> & { tenant_id: string; name: string };
        Update: Partial<NeighborhoodRow>;
        Relationships: [];
      };
      customers: {
        Row: CustomerRow;
        Insert: Partial<CustomerRow> & { tenant_id: string; name: string; phone: string };
        Update: Partial<CustomerRow>;
        Relationships: [];
      };
      addresses: {
        Row: AddressRow;
        Insert: Partial<AddressRow> & {
          customer_id: string;
          street: string;
          number: string;
          district: string;
        };
        Update: Partial<AddressRow>;
        Relationships: [];
      };
      promotions: {
        Row: PromotionRow;
        Insert: Partial<PromotionRow> & { tenant_id: string; title: string };
        Update: Partial<PromotionRow>;
        Relationships: [];
      };
      order_counters: {
        Row: OrderCounterRow;
        Insert: OrderCounterRow;
        Update: Partial<OrderCounterRow>;
        Relationships: [];
      };
      orders: {
        Row: OrderRow;
        Insert: Partial<OrderRow> & {
          tenant_id: string;
          order_number: string;
          customer_name: string;
          customer_phone: string;
          fulfillment: FulfillmentType;
          payment_method: PaymentMethod;
        };
        Update: Partial<OrderRow>;
        Relationships: [];
      };
      order_items: {
        Row: OrderItemRow;
        Insert: Partial<OrderItemRow> & {
          order_id: string;
          product_name: string;
          unit_price: number;
          quantity: number;
          line_total: number;
        };
        Update: Partial<OrderItemRow>;
        Relationships: [];
      };
      order_status_history: {
        Row: OrderStatusHistoryRow;
        Insert: Partial<OrderStatusHistoryRow> & { order_id: string; status: OrderStatus };
        Update: Partial<OrderStatusHistoryRow>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      is_admin: {
        Args: Record<string, never>;
        Returns: boolean;
        SetofOptions: { to: "boolean"; from: "is_admin"; isOneToOne: false };
      };
      next_order_number: {
        Args: { p_tenant: string };
        Returns: string;
        SetofOptions: { to: "text"; from: "next_order_number"; isOneToOne: false };
      };
      dashboard_metrics: {
        Args: { p_tenant: string; p_from: string; p_to: string };
        Returns: {
          orders_count: number;
          revenue: number;
          avg_ticket: number;
          by_status: { status: OrderStatus; count: number }[];
          top_products: { name: string; quantity: number }[];
        };
        SetofOptions: { to: "json"; from: "dashboard_metrics"; isOneToOne: false };
      };
    };
  };
}

export type Tenant = TenantRow;
export type Settings = SettingsRow;
export type BusinessHour = BusinessHourRow;
export type Admin = AdminRow;
export type Category = CategoryRow;
export type Product = ProductRow;
export type OptionGroup = OptionGroupRow;
export type ProductOption = ProductOptionRow;
export type ProductOptionGroupLink = ProductOptionGroupLinkRow;
export type Neighborhood = NeighborhoodRow;
export type Customer = CustomerRow;
export type Address = AddressRow;
export type Promotion = PromotionRow;
export type Order = OrderRow;
export type OrderItem = OrderItemRow;
export type OrderStatusHistory = OrderStatusHistoryRow;

/** Produto com seus grupos de opções e opções aninhadas — usado no cardápio e no checkout. */
export type ProductWithOptions = Product & {
  category: Pick<Category, "id" | "name" | "slug">;
  option_groups: (OptionGroup & { options: ProductOption[] })[];
};
