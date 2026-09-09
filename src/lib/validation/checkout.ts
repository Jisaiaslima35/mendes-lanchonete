import { z } from "zod";
import { onlyDigits } from "@/lib/utils";

export const checkoutItemSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.coerce.number().int().min(1).max(50),
  optionIds: z.array(z.string().uuid()).default([]),
  notes: z.string().trim().max(200).optional(),
});

const phoneSchema = z
  .string()
  .trim()
  .transform((v) => onlyDigits(v))
  .refine((v) => v.length === 10 || v.length === 11, {
    message: "Telefone inválido. Informe DDD + número.",
  });

const addressSchema = z.object({
  zip: z
    .string()
    .trim()
    .transform((v) => onlyDigits(v))
    .refine((v) => v.length === 8, { message: "CEP inválido." }),
  street: z.string().trim().min(2, "Informe a rua.").max(120),
  number: z.string().trim().min(1, "Informe o número.").max(20),
  complement: z.string().trim().max(80).optional(),
  district: z.string().trim().min(2, "Informe o bairro.").max(80),
  reference: z.string().trim().max(120).optional(),
  neighborhoodId: z.string().uuid({ message: "Selecione um bairro atendido." }),
});

export const checkoutSchema = z
  .object({
    fulfillment: z.enum(["delivery", "pickup"]),
    customerName: z.string().trim().min(2, "Informe seu nome.").max(80),
    customerPhone: phoneSchema,
    customerEmail: z
  .string()
  .trim()
  .email("Informe um e-mail válido.")
  .max(120),
    address: addressSchema.optional(),
    paymentMethod: z.enum(["pix", "cash", "card"]),
    changeFor: z.coerce.number().min(0).optional(),
    notes: z.string().trim().max(300).optional(),
    couponCode: z.string().trim().max(40).optional(),
    items: z.array(checkoutItemSchema).min(1, "O carrinho está vazio."),
  })
  .superRefine((data, ctx) => {
    if (data.fulfillment === "delivery" && !data.address) {
      ctx.addIssue({
        code: "custom",
        path: ["address"],
        message: "Informe o endereço de entrega.",
      });
    }
  });

export type CheckoutInput = z.infer<typeof checkoutSchema>;
export type CheckoutItemInput = z.infer<typeof checkoutItemSchema>;
