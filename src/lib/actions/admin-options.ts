"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase/server";
import { getCurrentTenantId } from "@/lib/tenant";
import { optionGroupSchema } from "@/lib/validation/admin";
import { actionError, actionOk, toUserMessage, type ActionResult } from "@/lib/errors";

export async function createOptionGroup(raw: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = optionGroupSchema.safeParse(raw);
  if (!parsed.success) return actionError("Verifique os dados informados.");

  try {
    const supabase = await createServerSupabase();
    const tenantId = await getCurrentTenantId();

    const { data, error } = await supabase
      .from("option_groups")
      .insert({
        tenant_id: tenantId,
        name: parsed.data.name,
        description: parsed.data.description || null,
        selection_type: parsed.data.selection_type,
        min_select: parsed.data.min_select,
        max_select: parsed.data.max_select ?? null,
        is_required: parsed.data.is_required,
        sort_order: parsed.data.sort_order,
        is_active: parsed.data.is_active,
      })
      .select("id")
      .single();
    if (error || !data) return actionError(toUserMessage(error));

    revalidatePath("/admin/adicionais");
    revalidatePath("/", "layout");
    return actionOk({ id: data.id });
  } catch (err) {
    return actionError(toUserMessage(err));
  }
}

export async function updateOptionGroup(id: string, raw: unknown): Promise<ActionResult> {
  const parsed = optionGroupSchema.safeParse(raw);
  if (!parsed.success) return actionError("Verifique os dados informados.");

  try {
    const supabase = await createServerSupabase();

    const { error } = await supabase
      .from("option_groups")
      .update({
        name: parsed.data.name,
        description: parsed.data.description || null,
        selection_type: parsed.data.selection_type,
        min_select: parsed.data.min_select,
        max_select: parsed.data.max_select ?? null,
        is_required: parsed.data.is_required,
        sort_order: parsed.data.sort_order,
        is_active: parsed.data.is_active,
      })
      .eq("id", id);
    if (error) return actionError(toUserMessage(error));

    revalidatePath("/admin/adicionais");
    revalidatePath(`/admin/adicionais/${id}`);
    revalidatePath("/", "layout");
    return actionOk();
  } catch (err) {
    return actionError(toUserMessage(err));
  }
}

export async function deleteOptionGroup(id: string): Promise<ActionResult> {
  try {
    const supabase = await createServerSupabase();
    const { error } = await supabase.from("option_groups").delete().eq("id", id);
    if (error) return actionError(toUserMessage(error));

    revalidatePath("/admin/adicionais");
    revalidatePath("/", "layout");
    return actionOk();
  } catch (err) {
    return actionError(toUserMessage(err));
  }
}

const optionRowSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1, "Informe o nome.").max(60),
  price_delta: z.coerce.number(),
  is_available: z.coerce.boolean().default(true),
  sort_order: z.coerce.number().int().min(0).default(0),
});

export async function saveOptions(groupId: string, raw: unknown[]): Promise<ActionResult> {
  const parsed = z.array(optionRowSchema).safeParse(raw);
  if (!parsed.success) return actionError("Verifique os adicionais informados.");

  try {
    const supabase = await createServerSupabase();

    const { data: existing, error: existingError } = await supabase
      .from("options")
      .select("id")
      .eq("group_id", groupId);
    if (existingError) return actionError(toUserMessage(existingError));

    const existingIds = new Set((existing ?? []).map((o) => o.id));
    const keptIds = new Set(parsed.data.filter((r) => r.id).map((r) => r.id as string));
    const removedIds = [...existingIds].filter((id) => !keptIds.has(id));

    if (removedIds.length > 0) {
      const { error } = await supabase.from("options").delete().in("id", removedIds);
      if (error) return actionError(toUserMessage(error));
    }

    for (const row of parsed.data) {
      if (row.id) {
        const { error } = await supabase
          .from("options")
          .update({
            name: row.name,
            price_delta: row.price_delta,
            is_available: row.is_available,
            sort_order: row.sort_order,
          })
          .eq("id", row.id);
        if (error) return actionError(toUserMessage(error));
      } else {
        const { error } = await supabase.from("options").insert({
          group_id: groupId,
          name: row.name,
          price_delta: row.price_delta,
          is_available: row.is_available,
          sort_order: row.sort_order,
        });
        if (error) return actionError(toUserMessage(error));
      }
    }

    revalidatePath(`/admin/adicionais/${groupId}`);
    revalidatePath("/", "layout");
    return actionOk();
  } catch (err) {
    return actionError(toUserMessage(err));
  }
}
