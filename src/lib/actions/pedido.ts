"use server";

import { createServerSupabase } from "@/lib/supabase/server";
import { actionError, actionOk, toUserMessage, type ActionResult } from "@/lib/errors";

export async function updatePublicPaymentStatus(
  token: string,
  paymentStatus: "pending",
): Promise<ActionResult> {
  try {
    const supabase = await createServerSupabase();

    const { error } = await supabase
      .from("orders")
      .update({ payment_status: paymentStatus })
      .eq("public_token", token);

    if (error) {
      return actionError(toUserMessage(error));
    }

    return actionOk();
  } catch (err) {
    return actionError(toUserMessage(err));
  }
}