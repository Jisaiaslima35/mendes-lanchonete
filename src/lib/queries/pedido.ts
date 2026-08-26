import "server-only";

import { createAdminSupabase } from "@/lib/supabase/admin";
import type { Order, OrderItem } from "@/types/database";

export async function getOrderByPublicToken(
  token: string,
): Promise<(Order & { order_items: OrderItem[] }) | null> {
  const db = createAdminSupabase();
  const { data, error } = await db
    .from("orders")
    .select("*, order_items(*)")
    .eq("public_token", token)
    .single();

  if (error || !data) return null;
  return data as unknown as Order & { order_items: OrderItem[] };
}
