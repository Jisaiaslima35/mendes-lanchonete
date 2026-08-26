"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/supabase/server";
import { orderStatusSchema } from "@/lib/validation/admin";
import { actionError, actionOk, toUserMessage, type ActionResult } from "@/lib/errors";

export async function updateOrderStatus(orderId: string, status: string): Promise<ActionResult> {
  const parsed = orderStatusSchema.safeParse({ orderId, status });
  if (!parsed.success) return actionError("Status inválido.");

  try {
    const supabase = await createServerSupabase();
    const { error } = await supabase
      .from("orders")
      .update({ status: parsed.data.status })
      .eq("id", parsed.data.orderId);

    if (error) return actionError(toUserMessage(error));

    revalidatePath("/admin/pedidos");
    return actionOk();
  } catch (err) {
    return actionError(toUserMessage(err));
  }
}
