/**
 * Helpers para QR codes — sem side-effects, funciona em server e client.
 *
 * A Evolution API v2.3.7 devolve o QR ja em formato data URL completo
 * (ex: `data:image/png;base64,iVBOR...`). Se o caller colocar isso
 * direto no `<img src>` funciona. Mas se a versao vier so com o base64
 * cru (caso de fallback / instancias antigas), o front precisa prefixar.
 * Sem normalizacao, concatenar prefixo duplo gera `ERR_INVALID_URL`
 * no console.
 *
 * Por isso: passe o QR cru pela `normalizeQrSrc()` ANTES de colocar no
 * `<img src>` — aqui ou no client. Quem consome nao precisa saber
 * qual formato veio.
 */

export function normalizeQrSrc(raw: string | null | undefined): string {
  if (!raw) return "";
  if (raw.startsWith("data:")) return raw;
  return `data:image/png;base64,${raw}`;
}
