"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/supabase/server";
import { getCurrentTenantId } from "@/lib/tenant";
import { promotionSchema } from "@/lib/validation/admin";
import { actionError, actionOk, toUserMessage, type ActionResult } from "@/lib/errors";

export async function createPromotion(raw: unknown): Promise<ActionResult> {
  const parsed = promotionSchema.safeParse(raw);
  if (!parsed.success) return actionError("Verifique os dados informados.");

  try {
    const supabase = await createServerSupabase();
    const tenantId = await getCurrentTenantId();

    const { error } = await supabase.from("promotions").insert({
      tenant_id: tenantId,
      title: parsed.data.title,
      description: parsed.data.description || null,
      image_url: parsed.data.image_url || null,
      type: parsed.data.type,
      value: parsed.data.value,
      coupon_code: parsed.data.coupon_code || null,
      min_order_value: parsed.data.min_order_value,
      starts_at: parsed.data.starts_at || null,
      ends_at: parsed.data.ends_at || null,
      is_active: parsed.data.is_active,
      sort_order: parsed.data.sort_order,
    });
    if (error) return actionError(toUserMessage(error));

    revalidatePath("/admin/promocoes");
    revalidatePath("/", "layout");
    revalidatePath("/cardapio");
    return actionOk();
  } catch (err) {
    return actionError(toUserMessage(err));
  }
}

export async function updatePromotion(id: string, raw: unknown): Promise<ActionResult> {
  const parsed = promotionSchema.safeParse(raw);
  if (!parsed.success) return actionError("Verifique os dados informados.");

  try {
    const supabase = await createServerSupabase();

    const { error } = await supabase
      .from("promotions")
      .update({
        title: parsed.data.title,
        description: parsed.data.description || null,
        image_url: parsed.data.image_url || null,
        type: parsed.data.type,
        value: parsed.data.value,
        coupon_code: parsed.data.coupon_code || null,
        min_order_value: parsed.data.min_order_value,
        starts_at: parsed.data.starts_at || null,
        ends_at: parsed.data.ends_at || null,
        is_active: parsed.data.is_active,
        sort_order: parsed.data.sort_order,
      })
      .eq("id", id);
    if (error) return actionError(toUserMessage(error));

    revalidatePath("/admin/promocoes");
    revalidatePath("/", "layout");
    revalidatePath("/cardapio");
    return actionOk();
  } catch (err) {
    return actionError(toUserMessage(err));
  }
}

export async function deletePromotion(id: string): Promise<ActionResult> {
  try {
    const supabase = await createServerSupabase();
    const { error } = await supabase.from("promotions").delete().eq("id", id);
    if (error) return actionError(toUserMessage(error));

    revalidatePath("/admin/promocoes");
    revalidatePath("/", "layout");
    revalidatePath("/cardapio");
    return actionOk();
  } catch (err) {
    return actionError(toUserMessage(err));
  }
}
