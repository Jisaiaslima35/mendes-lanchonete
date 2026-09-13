import { MercadoPagoConfig } from "mercadopago";

// Inicialização lazy: não explode em build/dev se o token não estiver configurado.
// Só dá erro em runtime quando alguém de fato chamar a função `getMercadoPago()`
// — ou seja, quando um cliente tentar pagar via Pix. Sem token, o erro é claro.
export function getMercadoPago(): MercadoPagoConfig {
  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!accessToken) {
    throw new Error(
      "MERCADOPAGO_ACCESS_TOKEN não configurado. Defina em .env.local para habilitar pagamentos via Pix."
    );
  }
  return new MercadoPagoConfig({ accessToken });
}
