import { MercadoPagoConfig } from "mercadopago";

const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;

if (!accessToken) {
  throw new Error("MERCADOPAGO_ACCESS_TOKEN não configurado.");
}

export const mercadoPago = new MercadoPagoConfig({
  accessToken,
});