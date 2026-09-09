import { NextResponse } from "next/server";
import { Payment } from "mercadopago";
import { mercadoPago } from "@/lib/mercadopago";
import { createAdminSupabase } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const { orderId, amount, description, payer } = body;

    if (!orderId || !payer?.email) {
      return NextResponse.json(
        { error: "Dados do pagamento incompletos." },
        { status: 400 },
      );
    }

    const supabase = createAdminSupabase();

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("id, total, payment_method")
      .eq("id", orderId)
      .single();

    if (orderError || !order) {
      return NextResponse.json(
        { error: "Pedido não encontrado." },
        { status: 404 },
      );
    }

    if (order.payment_method !== "pix") {
      return NextResponse.json(
        { error: "Este pedido não utiliza Pix." },
        { status: 400 },
      );
    }

    const payment = new Payment(mercadoPago);

    const result = await payment.create({
      body: {
        transaction_amount: Number(order.total),
        description: description || `Pedido #${order.id}`,
        payment_method_id: "pix",
        payer: {
          email: payer.email,
          first_name: payer.firstName || "Cliente",
          last_name: payer.lastName || "",
        },
        external_reference: order.id,
      },
    });

    const paymentId = result.id?.toString();

    const pixData = result.point_of_interaction?.transaction_data;

    if (!paymentId || !pixData) {
      return NextResponse.json(
        { error: "Não foi possível gerar a cobrança Pix." },
        { status: 500 },
      );
    }

    await supabase
      .from("orders")
      .update({
        payment_provider: "mercadopago",
        payment_transaction_id: paymentId,
      })
      .eq("id", order.id);

    return NextResponse.json({
      paymentId,
      status: result.status,
      qrCode: pixData.qr_code,
      qrCodeBase64: pixData.qr_code_base64,
      ticketUrl: pixData.ticket_url,
    });
  } catch (error) {
    console.error("Erro ao criar pagamento Pix:", error);

    return NextResponse.json(
      { error: "Não foi possível criar o pagamento Pix." },
      { status: 500 },
    );
  }
}