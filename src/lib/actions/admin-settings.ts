"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/supabase/server";
import { getCurrentTenantId } from "@/lib/tenant";
import { settingsSchema, businessHourSchema } from "@/lib/validation/admin";
import { actionError, actionOk, toUserMessage, type ActionResult } from "@/lib/errors";
import { z } from "zod";

export async function updateSettings(raw: unknown): Promise<ActionResult> {
  const parsed = settingsSchema.safeParse(raw);
  if (!parsed.success) return actionError("Verifique os dados informados.");

  try {
    const supabase = await createServerSupabase();
    const tenantId = await getCurrentTenantId();
    const { error } = await supabase.from("settings").update(parsed.data).eq("tenant_id", tenantId);
    if (error) return actionError(toUserMessage(error));

    revalidatePath("/", "layout");
    revalidatePath("/admin/configuracoes");
    return actionOk();
  } catch (err) {
    return actionError(toUserMessage(err));
  }
}

const hoursPayloadSchema = z.array(businessHourSchema.extend({ id: z.string().uuid().optional() }));

export async function updateBusinessHours(raw: unknown[]): Promise<ActionResult> {
  const parsed = hoursPayloadSchema.safeParse(raw);
  if (!parsed.success) return actionError("Horários inválidos.");

  try {
    const supabase = await createServerSupabase();
    const tenantId = await getCurrentTenantId();

    for (const hour of parsed.data) {
      if (hour.id) {
        const { error } = await supabase
          .from("business_hours")
          .update({
            opens_at: hour.opens_at,
            closes_at: hour.closes_at,
            is_closed: hour.is_closed,
          })
          .eq("id", hour.id);
        if (error) return actionError(toUserMessage(error));
      } else {
        const { error } = await supabase.from("business_hours").insert({
          tenant_id: tenantId,
          weekday: hour.weekday,
          opens_at: hour.opens_at,
          closes_at: hour.closes_at,
          is_closed: hour.is_closed,
        });
        if (error) return actionError(toUserMessage(error));
      }
    }

    revalidatePath("/", "layout");
    revalidatePath("/admin/configuracoes");
    return actionOk();
  } catch (err) {
    return actionError(toUserMessage(err));
  }
}
