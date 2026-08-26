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
