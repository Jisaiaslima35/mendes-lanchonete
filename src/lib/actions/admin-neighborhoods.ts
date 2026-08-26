"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/supabase/server";
import { getCurrentTenantId } from "@/lib/tenant";
import { neighborhoodSchema } from "@/lib/validation/admin";
import { actionError, actionOk, toUserMessage, type ActionResult } from "@/lib/errors";

export async function createNeighborhood(raw: unknown): Promise<ActionResult> {
  const parsed = neighborhoodSchema.safeParse(raw);
  if (!parsed.success) return actionError("Verifique os dados informados.");

  try {
    const supabase = await createServerSupabase();
    const tenantId = await getCurrentTenantId();

    const { error } = await supabase.from("neighborhoods").insert({
      tenant_id: tenantId,
      name: parsed.data.name,
      city: parsed.data.city || null,
      delivery_fee: parsed.data.delivery_fee,
      min_order_value: parsed.data.min_order_value,
      free_delivery_threshold: parsed.data.free_delivery_threshold ?? null,
      estimated_minutes: parsed.data.estimated_minutes,
      is_active: parsed.data.is_active,
    });
    if (error) return actionError(toUserMessage(error));

    revalidatePath("/admin/bairros");
    revalidatePath("/", "layout");
    return actionOk();
  } catch (err) {
    return actionError(toUserMessage(err));
  }
}

export async function updateNeighborhood(id: string, raw: unknown): Promise<ActionResult> {
  const parsed = neighborhoodSchema.safeParse(raw);
  if (!parsed.success) return actionError("Verifique os dados informados.");

  try {
    const supabase = await createServerSupabase();

    const { error } = await supabase
      .from("neighborhoods")
      .update({
        name: parsed.data.name,
        city: parsed.data.city || null,
        delivery_fee: parsed.data.delivery_fee,
        min_order_value: parsed.data.min_order_value,
        free_delivery_threshold: parsed.data.free_delivery_threshold ?? null,
        estimated_minutes: parsed.data.estimated_minutes,
        is_active: parsed.data.is_active,
      })
      .eq("id", id);
    if (error) return actionError(toUserMessage(error));

    revalidatePath("/admin/bairros");
    revalidatePath("/", "layout");
    return actionOk();
  } catch (err) {
    return actionError(toUserMessage(err));
  }
}

export async function deleteNeighborhood(id: string): Promise<ActionResult> {
  try {
    const supabase = await createServerSupabase();
    const { error } = await supabase.from("neighborhoods").delete().eq("id", id);
    if (error) return actionError(toUserMessage(error));

    revalidatePath("/admin/bairros");
    revalidatePath("/", "layout");
    return actionOk();
  } catch (err) {
    return actionError(toUserMessage(err));
  }
}
