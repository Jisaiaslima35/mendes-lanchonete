import "server-only";

import QRCode from "qrcode";

/**
 * Gera o QR Code em PNG base64 a partir do payload BR Code.
 * Retorna só o base64 (sem prefixo `data:image/png;base64,`) — o componente
 * <img> já concatena o prefixo automaticamente.
 *
 * Usado server-side no checkout pra persistir em `orders.pix_qr_code_base64`.
 */
export async function pixBRCodeToBase64(brcode: string): Promise<string> {
  const dataUrl = await QRCode.toDataURL(brcode, {
    errorCorrectionLevel: "M",
    margin: 2,
    width: 320,
    color: { dark: "#0f172a", light: "#ffffff" },
  });
  return dataUrl.replace(/^data:image\/png;base64,/, "");
}
