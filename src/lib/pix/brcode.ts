/**
 * Gerador de BR Code (Pix Copia e Cola) no padrão EMVCo do Banco Central.
 *
 * Sem dependência externa — gera o payload TLV + checksum CRC16-CCITT-FALSE
 * direto no servidor. Veja:
 *   - Manual de Padrões para Iniciação do Pix (Bacen):
 *     https://www.bcb.gov.br/content/estabilidadefinanceira/pix/Regulamento_Pix/II-ManualdePadroesparaIniciacaodoPix.pdf
 *
 * Estrutura TLV do BR Code (todos com ID 2 dígitos + length 2 dígitos + value):
 *   00 — Payload Format Indicator      → "01"
 *   26 — Merchant Account Information  → { 00: "br.gov.bcb.pix", 01: <chave> }
 *   52 — Merchant Category Code        → "0000"
 *   53 — Transaction Currency          → "986" (BRL)
 *   54 — Transaction Amount            → "35.50" (opcional)
 *   58 — Country Code                  → "BR"
 *   59 — Merchant Name                 → até 25 chars (sem acento)
 *   60 — Merchant City                 → até 15 chars (sem acento)
 *   62 — Additional Data Field Template → { 05: <txid> } (até 25 chars)
 *   63 — CRC16                         → "6304XXXX" (XXXX = checksum)
 *
 * Importante: o valor `54` é OPCIONAL. Pix estático sem valor funciona — o cliente
 * digita no app do banco. Mas pra Pix manual com valor travado a gente seta sempre.
 */

export interface PixManualInput {
  /** Chave Pix do recebedor (CPF/CNPJ/e-mail/celular/aleatória). */
  pixKey: string;
  /** Nome do recebedor — até 25 chars, sem acento, em uppercase. */
  merchantName: string;
  /** Cidade do recebedor — até 15 chars, sem acento, em uppercase. */
  merchantCity: string;
  /** Valor em reais. Ex: 35.5 → "35.50". */
  amount: number;
  /**
   * Identificador da transação (TxID). Até 25 chars alfanuméricos.
   * Pix manual aceita default "***" se você não tiver referência.
   */
  txid?: string;
}

/** Remove acentos, força uppercase, colapsa espaços e trunca no limite. */
function sanitize(text: string, maxLen: number): string {
  return text
    .normalize("NFD")                    // separa acento do caractere
    .replace(/[̀-ͯ]/g, "")      // remove marcas diacríticas
    .replace(/[^A-Za-z0-9 ]/g, " ")       // só alfanumérico + espaço
    .replace(/\s+/g, " ")                 // colapsa espaços múltiplos
    .trim()
    .toUpperCase()
    .slice(0, maxLen);
}

/** Monta um TLV (ID 2 chars + length 2 chars + value). */
function tlv(id: string, value: string): string {
  const len = value.length.toString().padStart(2, "0");
  return `${id}${len}${value}`;
}

/**
 * CRC16-CCITT-FALSE (padrão Pix / EMVCo).
 * poly=0x1021, init=0xFFFF, sem reflect-in, sem reflect-out, sem xor-out.
 * Resultado em 4 hex chars uppercase.
 */
export function crc16ccitt(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if (crc & 0x8000) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

/**
 * Monta o payload completo do BR Code com checksum CRC16.
 * O retorno é a string "Pix Copia e Cola" pronta pra copiar/colar ou virar QR.
 */
export function buildPixBRCode(input: PixManualInput): string {
  const pixKey = input.pixKey.trim();
  if (!pixKey) {
    throw new Error("pixKey obrigatório para gerar BR Code.");
  }

  const merchantName = sanitize(input.merchantName, 25);
  const merchantCity = sanitize(input.merchantCity, 15);
  const txid = (input.txid ?? "***").replace(/[^A-Za-z0-9]/g, "").slice(0, 25) || "***";

  if (!merchantName) throw new Error("merchantName obrigatório (recebedor).");
  if (!merchantCity) throw new Error("merchantCity obrigatório.");

  // Merchant Account Information: sub-TLVs dentro do campo 26.
  const merchantAccountInfo = tlv("00", "br.gov.bcb.pix") + tlv("01", pixKey);

  // Additional Data Field Template: sub-TLVs dentro do campo 62.
  // TxID 05 é o único sub-campo obrigatório quando o 62 está presente.
  const additionalData = tlv("05", txid);

  // Monta o payload SEM o CRC (campo 63 vem por último, calculado sobre o resto).
  const payloadWithoutCrc =
    tlv("00", "01") +
    tlv("26", merchantAccountInfo) +
    tlv("52", "0000") +
    tlv("53", "986") +
    tlv("54", input.amount.toFixed(2)) +
    tlv("58", "BR") +
    tlv("59", merchantName) +
    tlv("60", merchantCity) +
    tlv("62", additionalData) +
    "6304"; // placeholder do CRC (length fixo "04")

  const checksum = crc16ccitt(payloadWithoutCrc);
  return payloadWithoutCrc + checksum;
}
