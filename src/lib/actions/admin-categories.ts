"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/supabase/server";
import { getCurrentTenantId } from "@/lib/tenant";
import { categorySchema } from "@/lib/validation/admin";
import { actionError, actionOk, toUserMessage, type ActionResult } from "@/lib/errors";

export async function createCategory(raw: unknown): Promise<ActionResult> {
  const parsed = categorySchema.safeParse(raw);
  if (!parsed.success) return actionError("Verifique os dados informados.");

  try {
    const supabase = await createServerSupabase();
    const tenantId = await getCurrentTenantId();

    const { error } = await supabase.from("categories").insert({
      tenant_id: tenantId,
      name: parsed.data.name,
      slug: parsed.data.slug,
      description: parsed.data.description || null,
      image_url: parsed.data.image_url || null,
      sort_order: parsed.data.sort_order,
      is_active: parsed.data.is_active,
    });
    if (error) return actionError(toUserMessage(error));

    revalidatePath("/admin/categorias");
    revalidatePath("/", "layout");
    return actionOk();
  } catch (err) {
    return actionError(toUserMessage(err));
  }
}

export async function updateCategory(id: string, raw: unknown): Promise<ActionResult> {
  const parsed = categorySchema.safeParse(raw);
  if (!parsed.success) return actionError("Verifique os dados informados.");

  try {
    const supabase = await createServerSupabase();

    const { error } = await supabase
      .from("categories")
      .update({
        name: parsed.data.name,
        slug: parsed.data.slug,
        description: parsed.data.description || null,
        image_url: parsed.data.image_url || null,
        sort_order: parsed.data.sort_order,
        is_active: parsed.data.is_active,
      })
      .eq("id", id);
    if (error) return actionError(toUserMessage(error));

    revalidatePath("/admin/categorias");
    revalidatePath("/", "layout");
    return actionOk();
  } catch (err) {
    return actionError(toUserMessage(err));
  }
}

export async function deleteCategory(id: string): Promise<ActionResult> {
  try {
    const supabase = await createServerSupabase();
    const { error } = await supabase.from("categories").delete().eq("id", id);
    if (error) return actionError(toUserMessage(error));

    revalidatePath("/admin/categorias");
    revalidatePath("/", "layout");
    return actionOk();
  } catch (err) {
    return actionError(toUserMessage(err));
  }
}
