"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createCategory, updateCategory } from "@/lib/actions/admin-categories";
import { slugify } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea, FieldGroup, FieldError, Checkbox } from "@/components/ui/field";
import { ImageUpload } from "@/components/admin/image-upload";
import type { Category } from "@/types/database";

export function CategoryForm({ category }: { category?: Category }) {
  const router = useRouter();
  const [name, setName] = useState(category?.name ?? "");
  const [slug, setSlug] = useState(category?.slug ?? "");
  const [slugEditedManually, setSlugEditedManually] = useState(Boolean(category));
  const [description, setDescription] = useState(category?.description ?? "");
  const [imageUrl, setImageUrl] = useState(category?.image_url ?? "");
  const [sortOrder, setSortOrder] = useState(category?.sort_order ?? 0);
  const [isActive, setIsActive] = useState(category?.is_active ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setFieldErrors({});

    const payload = {
      name,
      slug,
      description,
      image_url: imageUrl,
      sort_order: sortOrder,
      is_active: isActive,
    };

    const result = category
      ? await updateCategory(category.id, payload)
      : await createCategory(payload);
    setSaving(false);

    if (!result.ok) {
      setError(result.error);
      setFieldErrors(result.fieldErrors ?? {});
      return;
    }
    router.push("/admin/categorias");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-lg space-y-4" noValidate>
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
          Slug (usado na URL do cardápio)
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
        <ImageUpload folder="categorias" value={imageUrl ?? ""} onChange={setImageUrl} />
      </FieldGroup>

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
        Categoria visível no cardápio
      </label>

      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <Button type="submit" disabled={saving}>
          {saving ? "Salvando..." : category ? "Salvar alterações" : "Criar categoria"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.push("/admin/categorias")}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
