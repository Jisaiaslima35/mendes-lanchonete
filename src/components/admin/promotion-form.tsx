"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createPromotion, updatePromotion } from "@/lib/actions/admin-promotions";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea, FieldGroup, FieldError, Checkbox } from "@/components/ui/field";
import { ImageUpload } from "@/components/admin/image-upload";
import type { Promotion, PromotionType } from "@/types/database";

const TYPE_LABELS: Record<PromotionType, string> = {
  percent: "Desconto percentual (cupom)",
  fixed: "Desconto em valor fixo (cupom)",
  free_delivery: "Frete grátis (cupom)",
  banner: "Apenas banner (sem desconto)",
};

function toDatetimeLocal(value: string | null) {
  if (!value) return "";
  return value.slice(0, 16);
}

export function PromotionForm({ promotion }: { promotion?: Promotion }) {
  const router = useRouter();
  const [title, setTitle] = useState(promotion?.title ?? "");
  const [description, setDescription] = useState(promotion?.description ?? "");
  const [imageUrl, setImageUrl] = useState(promotion?.image_url ?? "");
  const [type, setType] = useState<PromotionType>(promotion?.type ?? "banner");
  const [value, setValue] = useState(promotion?.value ?? 0);
  const [couponCode, setCouponCode] = useState(promotion?.coupon_code ?? "");
  const [minOrderValue, setMinOrderValue] = useState(promotion?.min_order_value ?? 0);
  const [startsAt, setStartsAt] = useState(toDatetimeLocal(promotion?.starts_at ?? null));
  const [endsAt, setEndsAt] = useState(toDatetimeLocal(promotion?.ends_at ?? null));
  const [isActive, setIsActive] = useState(promotion?.is_active ?? true);
  const [sortOrder, setSortOrder] = useState(promotion?.sort_order ?? 0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  const isCoupon = type !== "banner";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setFieldErrors({});

    const payload = {
      title,
      description,
      image_url: imageUrl,
      type,
      value: isCoupon ? value : 0,
      coupon_code: isCoupon ? couponCode : "",
      min_order_value: minOrderValue,
      starts_at: startsAt,
      ends_at: endsAt,
      is_active: isActive,
      sort_order: sortOrder,
    };

    const result = promotion
      ? await updatePromotion(promotion.id, payload)
      : await createPromotion(payload);
    setSaving(false);

    if (!result.ok) {
      setError(result.error);
      setFieldErrors(result.fieldErrors ?? {});
      return;
    }
    router.push("/admin/promocoes");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-lg space-y-4" noValidate>
      <FieldGroup>
        <Label htmlFor="title" required>
          Título
        </Label>
        <Input id="title" required value={title} onChange={(e) => setTitle(e.target.value)} />
        <FieldError message={fieldErrors.title?.[0]} />
      </FieldGroup>

      <FieldGroup>
        <Label htmlFor="description">Descrição</Label>
        <Textarea id="description" value={description ?? ""} onChange={(e) => setDescription(e.target.value)} />
      </FieldGroup>

      <FieldGroup>
        <Label>Imagem (opcional, usada no banner da home)</Label>
        <ImageUpload folder="promocoes" value={imageUrl ?? ""} onChange={setImageUrl} />
      </FieldGroup>

      <FieldGroup>
        <Label htmlFor="type" required>
          Tipo
        </Label>
        <Select id="type" value={type} onChange={(e) => setType(e.target.value as PromotionType)}>
          {Object.entries(TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </FieldGroup>

      {isCoupon && (
        <>
          <FieldGroup>
            <Label htmlFor="coupon_code" required>
              Código do cupom
            </Label>
            <Input
              id="coupon_code"
              required
              placeholder="Ex.: PROMO10"
              value={couponCode ?? ""}
              onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
            />
            <FieldError message={fieldErrors.coupon_code?.[0]} />
          </FieldGroup>

          {type !== "free_delivery" && (
            <FieldGroup>
              <Label htmlFor="value" required>
                {type === "percent" ? "Percentual de desconto (%)" : "Valor do desconto (R$)"}
              </Label>
              <Input
                id="value"
                type="number"
                step="0.01"
                min={0}
                required
                value={value}
                onChange={(e) => setValue(Number(e.target.value))}
              />
            </FieldGroup>
          )}

          <FieldGroup>
            <Label htmlFor="min_order_value">Pedido mínimo para usar o cupom (R$)</Label>
            <Input
              id="min_order_value"
              type="number"
              step="0.01"
              min={0}
              value={minOrderValue}
              onChange={(e) => setMinOrderValue(Number(e.target.value))}
            />
          </FieldGroup>
        </>
      )}

      <div className="grid grid-cols-2 gap-3">
        <FieldGroup className="mb-0">
          <Label htmlFor="starts_at">Início</Label>
          <Input
            id="starts_at"
            type="datetime-local"
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
          />
        </FieldGroup>
        <FieldGroup className="mb-0">
          <Label htmlFor="ends_at">Fim</Label>
          <Input id="ends_at" type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
        </FieldGroup>
      </div>

      <FieldGroup>
        <Label htmlFor="sort_order">Ordem de exibição</Label>
        <Input
          id="sort_order"
          type="number"
          value={sortOrder}
          onChange={(e) => setSortOrder(Number(e.target.value))}
        />
      </FieldGroup>

      <label className="flex items-center gap-2 text-sm text-stone-700">
        <Checkbox checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
        Promoção ativa
      </label>

      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <Button type="submit" disabled={saving}>
          {saving ? "Salvando..." : promotion ? "Salvar alterações" : "Criar promoção"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.push("/admin/promocoes")}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
