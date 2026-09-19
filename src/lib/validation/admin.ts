import { z } from "zod";
import { onlyDigits } from "@/lib/utils";

export const categorySchema = z.object({
  name: z.string().trim().min(2, "Informe o nome.").max(60),
  slug: z.string().trim().min(2).max(80).regex(/^[a-z0-9-]+$/, "Use apenas letras minúsculas, números e hífen."),
  description: z.string().trim().max(200).optional().or(z.literal("")),
  image_url: z.string().trim().url().optional().or(z.literal("")),
  sort_order: z.coerce.number().int().min(0).default(0),
  is_active: z.coerce.boolean().default(true),
});
export type CategoryInput = z.infer<typeof categorySchema>;

export const productSchema = z
  .object({
    category_id: z.string().uuid("Selecione uma categoria."),
    name: z.string().trim().min(2, "Informe o nome.").max(100),
    slug: z.string().trim().min(2).max(120).regex(/^[a-z0-9-]+$/, "Use apenas letras minúsculas, números e hífen."),
    description: z.string().trim().max(500).optional().or(z.literal("")),
    price: z.coerce.number().min(0, "Preço inválido."),
    promo_price: z.coerce.number().min(0).nullable().optional(),
    image_url: z.string().trim().url().optional().or(z.literal("")),
    is_featured: z.coerce.boolean().default(false),
    is_available: z.coerce.boolean().default(true),
    prep_minutes: z.coerce.number().int().min(0).max(240).default(15),
    sort_order: z.coerce.number().int().min(0).default(0),
    is_active: z.coerce.boolean().default(true),
    option_group_ids: z.array(z.string().uuid()).default([]),
  })
  .superRefine((data, ctx) => {
    if (data.promo_price != null && data.promo_price >= data.price) {
      ctx.addIssue({
        code: "custom",
        path: ["promo_price"],
        message: "O preço promocional deve ser menor que o preço normal.",
      });
    }
  });
export type ProductInput = z.infer<typeof productSchema>;

export const optionGroupSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome.").max(60),
  description: z.string().trim().max(200).optional().or(z.literal("")),
  selection_type: z.enum(["single", "multiple"]),
  min_select: z.coerce.number().int().min(0).default(0),
  max_select: z.coerce.number().int().min(1).nullable().optional(),
  is_required: z.coerce.boolean().default(false),
  sort_order: z.coerce.number().int().min(0).default(0),
  is_active: z.coerce.boolean().default(true),
});
export type OptionGroupInput = z.infer<typeof optionGroupSchema>;

export const optionSchema = z.object({
  group_id: z.string().uuid(),
  name: z.string().trim().min(1, "Informe o nome.").max(60),
  price_delta: z.coerce.number().default(0),
  is_available: z.coerce.boolean().default(true),
  sort_order: z.coerce.number().int().min(0).default(0),
});
export type OptionInput = z.infer<typeof optionSchema>;

export const neighborhoodSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome.").max(80),
  city: z.string().trim().max(80).optional().or(z.literal("")),
  delivery_fee: z.coerce.number().min(0).default(0),
  min_order_value: z.coerce.number().min(0).default(0),
  free_delivery_threshold: z.coerce.number().min(0).nullable().optional(),
  estimated_minutes: z.coerce.number().int().min(0).max(240).default(40),
  is_active: z.coerce.boolean().default(true),
});
export type NeighborhoodInput = z.infer<typeof neighborhoodSchema>;

export const promotionSchema = z.object({
  title: z.string().trim().min(2, "Informe o título.").max(100),
  description: z.string().trim().max(300).optional().or(z.literal("")),
  image_url: z.string().trim().url().optional().or(z.literal("")),
  type: z.enum(["percent", "fixed", "free_delivery", "banner"]),
  value: z.coerce.number().min(0).default(0),
  coupon_code: z.string().trim().max(40).optional().or(z.literal("")),
  min_order_value: z.coerce.number().min(0).default(0),
  starts_at: z.string().trim().optional().or(z.literal("")),
  ends_at: z.string().trim().optional().or(z.literal("")),
  is_active: z.coerce.boolean().default(true),
  sort_order: z.coerce.number().int().min(0).default(0),
});
export type PromotionInput = z.infer<typeof promotionSchema>;

export const businessHourSchema = z.object({
  weekday: z.coerce.number().int().min(0).max(6),
  opens_at: z.string().trim().regex(/^\d{2}:\d{2}$/, "Hora inválida."),
  closes_at: z.string().trim().regex(/^\d{2}:\d{2}$/, "Hora inválida."),
  is_closed: z.coerce.boolean().default(false),
});
export type BusinessHourInput = z.infer<typeof businessHourSchema>;

export const settingsSchema = z.object({
  business_name: z.string().trim().min(2).max(120),
  logo_url: z.string().trim().url().optional().or(z.literal("")),
  banner_url: z.string().trim().url().optional().or(z.literal("")),
  primary_color: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, "Cor inválida."),
  accent_color: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, "Cor inválida."),
  whatsapp_number: z
    .string()
    .trim()
    .transform((v) => onlyDigits(v))
    .refine((v) => v.length >= 10 && v.length <= 13, "Número de WhatsApp inválido."),
  phone: z.string().trim().max(20).optional().or(z.literal("")),
  instagram_url: z.string().trim().url().optional().or(z.literal("")),
  facebook_url: z.string().trim().url().optional().or(z.literal("")),
  maps_url: z.string().trim().url().optional().or(z.literal("")),
  address_street: z.string().trim().max(120).optional().or(z.literal("")),
  address_number: z.string().trim().max(20).optional().or(z.literal("")),
  address_complement: z.string().trim().max(80).optional().or(z.literal("")),
  address_district: z.string().trim().max(80).optional().or(z.literal("")),
  address_city: z.string().trim().max(80).optional().or(z.literal("")),
  address_state: z.string().trim().max(2).optional().or(z.literal("")),
  address_zip: z.string().trim().max(9).optional().or(z.literal("")),
  avg_delivery_minutes: z.coerce.number().int().min(0).max(240),
  avg_pickup_minutes: z.coerce.number().int().min(0).max(240),
  min_order_value: z.coerce.number().min(0),
  free_delivery_threshold: z.coerce.number().min(0).nullable().optional(),
  accepts_delivery: z.coerce.boolean(),
  accepts_pickup: z.coerce.boolean(),
  manual_closed: z.coerce.boolean(),
  closed_message: z.string().trim().max(200),
  payment_pix: z.coerce.boolean(),
  payment_cash: z.coerce.boolean(),
  payment_card: z.coerce.boolean(),
  pix_key: z.string().trim().max(140).optional().or(z.literal("")),
  pix_key_type: z.string().trim().max(20).optional().or(z.literal("")),
  /**
   * Lote 1 auditoria — campos adicionados em 2026-09-16_store_coords_pix.sql.
   * Coordenadas próprias (isoladas por tenant) e dados extras do Pix
   * (beneficiário + QR estático fallback + mensagem de recibo).
   * Tudo opcional: se vazio, frete cai pra FALLBACK_FEE (R$3) e o checkout
   * usa só a chave Pix dinâmica do MercadoPago.
   */
  store_lat: z.coerce
    .number()
    .min(-90, "Latitude deve estar entre -90 e 90.")
    .max(90, "Latitude deve estar entre -90 e 90.")
    .nullable()
    .optional()
    .or(z.literal("")),
  store_lng: z.coerce
    .number()
    .min(-180, "Longitude deve estar entre -180 e 180.")
    .max(180, "Longitude deve estar entre -180 e 180.")
    .nullable()
    .optional()
    .or(z.literal("")),
  store_cep: z
    .string()
    .trim()
    .transform((v) => onlyDigits(v))
    .refine((v) => v.length === 0 || v.length === 8, "CEP deve ter 8 dígitos.")
    .optional()
    .or(z.literal("")),
  pix_beneficiary: z.string().trim().max(120).optional().or(z.literal("")),
  pix_static_qr_base64: z.string().trim().max(500_000).optional().or(z.literal("")),
  pix_receipt_message: z.string().trim().max(300).optional().or(z.literal("")),
  /**
   * Pix Manual (BR Code / EMVCo) — campos adicionados em
   * 2026-09-18_pix_manual_brcode.sql. Quando `pix_manual_enabled = true` o checkout
   * gera o payload BR Code no servidor (sem MercadoPago) e grava em `orders`.
   */
  pix_merchant_city: z.string().trim().max(80).optional().or(z.literal("")),
  pix_manual_enabled: z.coerce.boolean().default(false),
  order_prefix: z.string().trim().max(10),
});
export type SettingsInput = z.infer<typeof settingsSchema>;

export const orderStatusSchema = z.object({
  orderId: z.string().uuid(),
  status: z.enum([
    "novo",
    "confirmado",
    "em_preparo",
    "pronto",
    "saiu_entrega",
    "entregue",
    "cancelado",
  ]),
});
export type OrderStatusInput = z.infer<typeof orderStatusSchema>;

export const customerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  phone: z
    .string()
    .trim()
    .transform((v) => onlyDigits(v))
    .refine((v) => v.length === 10 || v.length === 11, "Telefone inválido."),
  email: z.string().trim().email().optional().or(z.literal("")),
  notes: z.string().trim().max(300).optional().or(z.literal("")),
});
export type CustomerInput = z.infer<typeof customerSchema>;

/**
 * Schema do form "Novo Estabelecimento" (/super-admin).
 *
 * Regras:
 * - `slug` deve bater com o subdomain (sem o rootDomain): letras minusculas,
 *   numeros e hifen. E usado como chave no roteamento por host
 *   (`mendes-teste.automacaojs.us` -> slug `mendes-teste`).
 * - `subdomain` eh o FQDN completo (ex: `formiga.automacaojs.us`). Pode
 *   ficar vazio se o dono quiser configurar DNS depois.
 * - `owner_phone` eh o WhatsApp do dono no formato wa.me (DDI+DDD+numero).
 * - `seed_tables` / `seed_categories` controlam o que eh provisionado na
 *   criacao (5 mesas ativas + 2 categorias padrao: "Lanches" + "Bebidas").
 */
export const tenantCreateSchema = z
  .object({
    name: z.string().trim().min(2, "Informe o nome.").max(80),
    slug: z
      .string()
      .trim()
      .min(2)
      .max(80)
      .regex(/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/, "Use apenas letras minúsculas, números e hífen."),
    subdomain: z
      .string()
      .trim()
      .max(200)
      .optional()
      .or(z.literal("")),
    owner_phone: z
      .string()
      .trim()
      .transform((v) => onlyDigits(v))
      .refine(
        (v) => v.length === 0 || (v.length >= 10 && v.length <= 13),
        "WhatsApp inválido (DDI + DDD + número).",
      )
      .optional()
      .or(z.literal("")),
    owner_email: z
      .string()
      .trim()
      .email("E-mail inválido.")
      .max(120)
      .optional()
      .or(z.literal("")),
    owner_password: z
      .string()
      .trim()
      .min(6, "A senha deve ter pelo menos 6 caracteres.")
      .max(100)
      .optional()
      .or(z.literal("")),
    seed_tables: z.coerce.boolean().default(true),
    seed_categories: z.coerce.boolean().default(true),
  })
  .superRefine((data, ctx) => {
    if (data.subdomain && data.subdomain.length > 0) {
      const sub = data.subdomain.toLowerCase();
      const root = (process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "automacaojs.us").toLowerCase();
      if (!sub.endsWith(`.${root}`)) {
        ctx.addIssue({
          code: "custom",
          path: ["subdomain"],
          message: `Subdomínio deve terminar com ".${root}".`,
        });
      }
    }
  });
export type TenantCreateInput = z.infer<typeof tenantCreateSchema>;
