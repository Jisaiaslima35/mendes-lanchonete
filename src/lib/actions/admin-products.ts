"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/supabase/server";
import { getCurrentTenantId } from "@/lib/tenant";
import { productSchema } from "@/lib/validation/admin";
import { actionError, actionOk, toUserMessage, type ActionResult } from "@/lib/errors";

type ServerSupabase = Awaited<ReturnType<typeof createServerSupabase>>;

async function syncOptionGroups(supabase: ServerSupabase, productId: string, groupIds: string[]) {
  const { error: deleteError } = await supabase
    .from("product_option_groups")
    .delete()
    .eq("product_id", productId);
  if (deleteError) return deleteError;

  if (groupIds.length === 0) return null;

  const rows = groupIds.map((groupId, index) => ({
    product_id: productId,
    group_id: groupId,
    sort_order: index,
  }));
  const { error: insertError } = await supabase.from("product_option_groups").insert(rows);
  return insertError;
}

export async function createProduct(raw: unknown): Promise<ActionResult> {
  const parsed = productSchema.safeParse(raw);
  if (!parsed.success) return actionError("Verifique os dados informados.");
  const { option_group_ids, ...data } = parsed.data;

  try {
    const supabase = await createServerSupabase();
    const tenantId = await getCurrentTenantId();

    const { data: product, error } = await supabase
      .from("products")
      .insert({
        tenant_id: tenantId,
        category_id: data.category_id,
        name: data.name,
        slug: data.slug,
        description: data.description || null,
        price: data.price,
        promo_price: data.promo_price ?? null,
        image_url: data.image_url || null,
        is_featured: data.is_featured,
        is_available: data.is_available,
        prep_minutes: data.prep_minutes,
        sort_order: data.sort_order,
        is_active: data.is_active,
      })
      .select("id")
      .single();
    if (error || !product) return actionError(toUserMessage(error));

    const linkError = await syncOptionGroups(supabase, product.id, option_group_ids);
    if (linkError) return actionError(toUserMessage(linkError));

    revalidatePath("/admin/produtos");
    revalidatePath("/", "layout");
    revalidatePath("/cardapio");
    return actionOk();
  } catch (err) {
    return actionError(toUserMessage(err));
  }
}

export async function updateProduct(id: string, raw: unknown): Promise<ActionResult> {
  const parsed = productSchema.safeParse(raw);
  if (!parsed.success) return actionError("Verifique os dados informados.");
  const { option_group_ids, ...data } = parsed.data;

  try {
    const supabase = await createServerSupabase();

    const { error } = await supabase
      .from("products")
      .update({
        category_id: data.category_id,
        name: data.name,
        slug: data.slug,
        description: data.description || null,
        price: data.price,
        promo_price: data.promo_price ?? null,
        image_url: data.image_url || null,
        is_featured: data.is_featured,
        is_available: data.is_available,
        prep_minutes: data.prep_minutes,
        sort_order: data.sort_order,
        is_active: data.is_active,
      })
      .eq("id", id);
    if (error) return actionError(toUserMessage(error));

    const linkError = await syncOptionGroups(supabase, id, option_group_ids);
    if (linkError) return actionError(toUserMessage(linkError));

    revalidatePath("/admin/produtos");
    revalidatePath("/", "layout");
    revalidatePath("/cardapio");
    return actionOk();
  } catch (err) {
    return actionError(toUserMessage(err));
  }
}

export async function deleteProduct(id: string): Promise<ActionResult> {
  try {
    const supabase = await createServerSupabase();
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) return actionError(toUserMessage(error));

    revalidatePath("/admin/produtos");
    revalidatePath("/", "layout");
    revalidatePath("/cardapio");
    return actionOk();
  } catch (err) {
    return actionError(toUserMessage(err));
  }
}
