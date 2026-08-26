import "server-only";

import { cache } from "react";
import { createServerSupabase } from "@/lib/supabase/server";
import { getCurrentTenantId } from "@/lib/tenant";
import type {
  BusinessHour,
  Category,
  Neighborhood,
  Product,
  ProductWithOptions,
  Promotion,
  Settings,
} from "@/types/database";

export const getSettings = cache(async (): Promise<Settings> => {
  const supabase = await createServerSupabase();
  const tenantId = await getCurrentTenantId();
  const { data, error } = await supabase
    .from("settings")
    .select("*")
    .eq("tenant_id", tenantId)
    .single();
  if (error || !data) throw new Error("Configurações da loja não encontradas.");
  return data;
});

export const getBusinessHours = cache(async (): Promise<BusinessHour[]> => {
  const supabase = await createServerSupabase();
  const tenantId = await getCurrentTenantId();
  const { data } = await supabase
    .from("business_hours")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("weekday", { ascending: true });
  return data ?? [];
});

export const getCategories = cache(async (): Promise<Category[]> => {
  const supabase = await createServerSupabase();
  const tenantId = await getCurrentTenantId();
  const { data } = await supabase
    .from("categories")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  return data ?? [];
});

export const getCategoriesWithProducts = cache(async (): Promise<
  (Category & { products: Product[] })[]
> => {
  const supabase = await createServerSupabase();
  const tenantId = await getCurrentTenantId();
  const { data, error } = await supabase
    .from("categories")
    .select("*, products(*)")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .eq("products.is_active", true)
    .order("sort_order", { ascending: true });

  if (error || !data) return [];

  return (data as unknown as (Category & { products: Product[] })[]).map((cat) => ({
    ...cat,
    products: (cat.products ?? []).sort((a, b) => a.sort_order - b.sort_order),
  }));
});

export const getFeaturedProducts = cache(async (): Promise<Product[]> => {
  const supabase = await createServerSupabase();
  const tenantId = await getCurrentTenantId();
  const { data } = await supabase
    .from("products")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .eq("is_featured", true)
    .order("sort_order", { ascending: true })
    .limit(8);
  return data ?? [];
});

export const getBestSellers = cache(async (): Promise<Product[]> => {
  const supabase = await createServerSupabase();
  const tenantId = await getCurrentTenantId();
  const { data } = await supabase
    .from("products")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .order("sold_count", { ascending: false })
    .limit(8);
  return data ?? [];
});

export const getPromotionProducts = cache(async (): Promise<Product[]> => {
  const supabase = await createServerSupabase();
  const tenantId = await getCurrentTenantId();
  const { data } = await supabase
    .from("products")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .not("promo_price", "is", null)
    .order("sort_order", { ascending: true });
  return data ?? [];
});

export const getBannerPromotions = cache(async (): Promise<Promotion[]> => {
  const supabase = await createServerSupabase();
  const tenantId = await getCurrentTenantId();
  const { data } = await supabase
    .from("promotions")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .eq("type", "banner")
    .order("sort_order", { ascending: true });
  return data ?? [];
});

export const getNeighborhoods = cache(async (): Promise<Neighborhood[]> => {
  const supabase = await createServerSupabase();
  const tenantId = await getCurrentTenantId();
  const { data } = await supabase
    .from("neighborhoods")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .order("name", { ascending: true });
  return data ?? [];
});

export async function getProductBySlug(slug: string): Promise<ProductWithOptions | null> {
  const supabase = await createServerSupabase();
  const tenantId = await getCurrentTenantId();

  const { data, error } = await supabase
    .from("products")
    .select(
      `*, category:categories!inner(id, name, slug),
       product_option_groups(sort_order, option_groups(*, options(*)))`,
    )
    .eq("tenant_id", tenantId)
    .eq("slug", slug)
    .eq("is_active", true)
    .single();

  if (error || !data) return null;

  type Raw = Product & {
    category: { id: string; name: string; slug: string };
    product_option_groups: {
      sort_order: number;
      option_groups: ProductWithOptions["option_groups"][number];
    }[];
  };
  const raw = data as unknown as Raw;

  const optionGroups = (raw.product_option_groups ?? [])
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((link) => ({
      ...link.option_groups,
      options: (link.option_groups.options ?? [])
        .filter((o) => o.is_available)
        .sort((a, b) => a.sort_order - b.sort_order),
    }))
    .filter((g) => g.is_active);

  return { ...raw, category: raw.category, option_groups: optionGroups };
}
