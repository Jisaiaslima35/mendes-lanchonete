import { NextResponse } from "next/server";
import { Payment } from "mercadopago";
import { getMercadoPago } from "@/lib/mercadopago";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { resolveTenantOrigin } from "@/lib/tenant-host";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const { orderId, amount, description, payer } = body;

    if (!orderId) {
      return NextResponse.json(
        { error: "orderId é obrigatório." },
        { status: 400 },
      );
    }

    const supabase = createAdminSupabase();

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("id, total, payment_method, tenant_id")
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

    // Fallbacks para não rejeitar o Pix quando o cliente não preencher tudo.
    // Em produção o MP exige email + CPF válidos para emitir o QR.
    const fallbackEmail =
      process.env.MP_DEFAULT_PAYER_EMAIL || "cliente@automacaojs.us";
    const fallbackCpf = process.env.MP_DEFAULT_PAYER_CPF || "12345678909";

    // notificationUrl deve apontar pro subdominio do tenant do pedido, nao
    // pro NEXT_PUBLIC_SITE_URL estatico (que pode ser de outro tenant).
    let notificationUrl = process.env.MP_NOTIFICATION_URL?.trim() ?? "";
    if (!notificationUrl) {
      const { data: tenant } = await supabase
        .from("tenants")
        .select("slug")
        .eq("id", order.tenant_id)
        .maybeSingle();
      const origin = resolveTenantOrigin(request.headers.get("host"), tenant?.slug ?? "mendes");
      notificationUrl = `${origin}/api/webhooks/mercadopago`;
    }

    const payerEmail = payer?.email?.trim() || fallbackEmail;
    const payerCpf = (payer?.cpf || fallbackCpf).replace(/\D/g, "");

    const mercadoPago = getMercadoPago();
    const payment = new Payment(mercadoPago);

    // Garante 2 casas decimais que o gateway exige (1 vira 1.00).
    const amountNumber = Number(Number(order.total).toFixed(2));

    const result = await payment.create({
      body: {
        transaction_amount: amountNumber,
        description: description || `Pedido #${order.id}`,
        payment_method_id: "pix",
        payer: {
          email: payerEmail,
          first_name: payer?.firstName || "Cliente",
          last_name: payer?.lastName || "",
          identification: {
            type: "CPF",
            number: payerCpf,
          },
        },
        notification_url: notificationUrl,
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
        pix_qr_code: pixData.qr_code,
        pix_qr_code_base64: pixData.qr_code_base64,
        pix_ticket_url: pixData.ticket_url,
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
