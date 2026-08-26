"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createProduct, updateProduct } from "@/lib/actions/admin-products";
import { slugify } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea, FieldGroup, FieldError, Checkbox } from "@/components/ui/field";
import { ImageUpload } from "@/components/admin/image-upload";
import type { Category, OptionGroup, Product } from "@/types/database";

export function ProductForm({
  product,
  categories,
  optionGroups,
  linkedGroupIds = [],
}: {
  product?: Product;
  categories: Category[];
  optionGroups: OptionGroup[];
  linkedGroupIds?: string[];
}) {
  const router = useRouter();
  const [categoryId, setCategoryId] = useState(product?.category_id ?? categories[0]?.id ?? "");
  const [name, setName] = useState(product?.name ?? "");
  const [slug, setSlug] = useState(product?.slug ?? "");
  const [slugEditedManually, setSlugEditedManually] = useState(Boolean(product));
  const [description, setDescription] = useState(product?.description ?? "");
  const [price, setPrice] = useState(product?.price ?? 0);
  const [promoPrice, setPromoPrice] = useState(product?.promo_price != null ? String(product.promo_price) : "");
  const [imageUrl, setImageUrl] = useState(product?.image_url ?? "");
  const [isFeatured, setIsFeatured] = useState(product?.is_featured ?? false);
  const [isAvailable, setIsAvailable] = useState(product?.is_available ?? true);
  const [prepMinutes, setPrepMinutes] = useState(product?.prep_minutes ?? 15);
  const [sortOrder, setSortOrder] = useState(product?.sort_order ?? 0);
  const [isActive, setIsActive] = useState(product?.is_active ?? true);
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>(linkedGroupIds);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  function toggleGroup(groupId: string) {
    setSelectedGroupIds((prev) =>
      prev.includes(groupId) ? prev.filter((id) => id !== groupId) : [...prev, groupId],
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setFieldErrors({});

    const payload = {
      category_id: categoryId,
      name,
      slug,
      description,
      price,
      promo_price: promoPrice === "" ? null : Number(promoPrice),
      image_url: imageUrl,
      is_featured: isFeatured,
      is_available: isAvailable,
      prep_minutes: prepMinutes,
      sort_order: sortOrder,
      is_active: isActive,
      option_group_ids: selectedGroupIds,
    };

    const result = product ? await updateProduct(product.id, payload) : await createProduct(payload);
    setSaving(false);

    if (!result.ok) {
      setError(result.error);
      setFieldErrors(result.fieldErrors ?? {});
      return;
    }
    router.push("/admin/produtos");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-lg space-y-4" noValidate>
      <FieldGroup>
        <Label htmlFor="category_id" required>
          Categoria
        </Label>
        <Select id="category_id" required value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
        <FieldError message={fieldErrors.category_id?.[0]} />
      </FieldGroup>

      <FieldGroup>
        <Label htmlFor="name" required>
          Nome
        </Label>
        <Input
          id="name"
          required
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (!slugEditedManually) setSlug(slugify(e.target.value));
          }}
        />
        <FieldError message={fieldErrors.name?.[0]} />
      </FieldGroup>

      <FieldGroup>
        <Label htmlFor="slug" required>
          Slug (usado na URL do produto)
        </Label>
        <Input
          id="slug"
          required
          value={slug}
          onChange={(e) => {
            setSlugEditedManually(true);
            setSlug(e.target.value);
          }}
        />
        <FieldError message={fieldErrors.slug?.[0]} />
      </FieldGroup>

      <FieldGroup>
        <Label htmlFor="description">Descrição</Label>
        <Textarea id="description" value={description ?? ""} onChange={(e) => setDescription(e.target.value)} />
      </FieldGroup>

      <FieldGroup>
        <Label>Imagem</Label>
        <ImageUpload folder="produtos" value={imageUrl ?? ""} onChange={setImageUrl} />
      </FieldGroup>

      <div className="grid grid-cols-2 gap-3">
        <FieldGroup className="mb-0">
          <Label htmlFor="price" required>
            Preço (R$)
          </Label>
          <Input
            id="price"
            type="number"
            step="0.01"
            min={0}
            required
            value={price}
            onChange={(e) => setPrice(Number(e.target.value))}
          />
          <FieldError message={fieldErrors.price?.[0]} />
        </FieldGroup>
        <FieldGroup className="mb-0">
          <Label htmlFor="promo_price">Preço promocional (R$)</Label>
          <Input
            id="promo_price"
            type="number"
            step="0.01"
            min={0}
            placeholder="Sem promoção"
            value={promoPrice}
            onChange={(e) => setPromoPrice(e.target.value)}
          />
          <FieldError message={fieldErrors.promo_price?.[0]} />
        </FieldGroup>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <FieldGroup className="mb-0">
          <Label htmlFor="prep_minutes">Tempo de preparo (min)</Label>
          <Input
            id="prep_minutes"
            type="number"
            min={0}
            value={prepMinutes}
            onChange={(e) => setPrepMinutes(Number(e.target.value))}
          />
        </FieldGroup>
        <FieldGroup className="mb-0">
          <Label htmlFor="sort_order">Ordem de exibição</Label>
          <Input
            id="sort_order"
            type="number"
            value={sortOrder}
            onChange={(e) => setSortOrder(Number(e.target.value))}
          />
        </FieldGroup>
      </div>

      {optionGroups.length > 0 && (
        <FieldGroup>
          <Label>Grupos de adicionais</Label>
          <div className="space-y-1.5 rounded-lg border border-stone-200 p-3">
            {optionGroups.map((group) => (
              <label key={group.id} className="flex items-center gap-2 text-sm text-stone-700">
                <Checkbox
                  checked={selectedGroupIds.includes(group.id)}
                  onChange={() => toggleGroup(group.id)}
                />
                {group.name}
                {!group.is_active && <span className="text-xs text-stone-400">(inativo)</span>}
              </label>
            ))}
          </div>
        </FieldGroup>
      )}

      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm text-stone-700">
          <Checkbox checked={isFeatured} onChange={(e) => setIsFeatured(e.target.checked)} />
          Destaque (aparece em &quot;Mais vendidos/Destaques&quot;)
        </label>
        <label className="flex items-center gap-2 text-sm text-stone-700">
          <Checkbox checked={isAvailable} onChange={(e) => setIsAvailable(e.target.checked)} />
          Disponível agora (desmarque para marcar como esgotado)
        </label>
        <label className="flex items-center gap-2 text-sm text-stone-700">
          <Checkbox checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
          Visível no cardápio
        </label>
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <Button type="submit" disabled={saving}>
          {saving ? "Salvando..." : product ? "Salvar alterações" : "Criar produto"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.push("/admin/produtos")}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
