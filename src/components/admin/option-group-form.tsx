"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createOptionGroup, updateOptionGroup } from "@/lib/actions/admin-options";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea, FieldGroup, FieldError, Checkbox } from "@/components/ui/field";
import type { OptionGroup, SelectionType } from "@/types/database";

export function OptionGroupForm({ group }: { group?: OptionGroup }) {
  const router = useRouter();
  const [name, setName] = useState(group?.name ?? "");
  const [description, setDescription] = useState(group?.description ?? "");
  const [selectionType, setSelectionType] = useState<SelectionType>(group?.selection_type ?? "single");
  const [minSelect, setMinSelect] = useState(group?.min_select ?? 0);
  const [maxSelect, setMaxSelect] = useState(group?.max_select != null ? String(group.max_select) : "");
  const [isRequired, setIsRequired] = useState(group?.is_required ?? false);
  const [sortOrder, setSortOrder] = useState(group?.sort_order ?? 0);
  const [isActive, setIsActive] = useState(group?.is_active ?? true);
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
      description,
      selection_type: selectionType,
      min_select: minSelect,
      max_select: maxSelect === "" ? null : Number(maxSelect),
      is_required: isRequired,
      sort_order: sortOrder,
      is_active: isActive,
    };

    if (group) {
      const result = await updateOptionGroup(group.id, payload);
      setSaving(false);
      if (!result.ok) {
        setError(result.error);
        setFieldErrors(result.fieldErrors ?? {});
        return;
      }
      router.refresh();
      return;
    }

    const result = await createOptionGroup(payload);
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      setFieldErrors(result.fieldErrors ?? {});
      return;
    }
    router.push(`/admin/adicionais/${result.data.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-lg space-y-4" noValidate>
      <FieldGroup>
        <Label htmlFor="name" required>
          Nome do grupo
        </Label>
        <Input id="name" required placeholder='Ex.: "Tamanho", "Adicionais"' value={name} onChange={(e) => setName(e.target.value)} />
        <FieldError message={fieldErrors.name?.[0]} />
      </FieldGroup>

      <FieldGroup>
        <Label htmlFor="description">Descrição</Label>
        <Textarea id="description" value={description ?? ""} onChange={(e) => setDescription(e.target.value)} />
      </FieldGroup>

      <FieldGroup>
        <Label htmlFor="selection_type" required>
          Tipo de seleção
        </Label>
        <Select
          id="selection_type"
          value={selectionType}
          onChange={(e) => setSelectionType(e.target.value as SelectionType)}
        >
          <option value="single">Única escolha (ex.: Tamanho)</option>
          <option value="multiple">Múltipla escolha (ex.: Adicionais)</option>
        </Select>
      </FieldGroup>

      <div className="grid grid-cols-2 gap-3">
        <FieldGroup className="mb-0">
          <Label htmlFor="min_select">Mínimo de opções</Label>
          <Input
            id="min_select"
            type="number"
            min={0}
            value={minSelect}
            onChange={(e) => setMinSelect(Number(e.target.value))}
          />
        </FieldGroup>
        <FieldGroup className="mb-0">
          <Label htmlFor="max_select">Máximo de opções</Label>
          <Input
            id="max_select"
            type="number"
            min={1}
            placeholder="Sem limite"
            value={maxSelect}
            onChange={(e) => setMaxSelect(e.target.value)}
          />
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
        <Checkbox checked={isRequired} onChange={(e) => setIsRequired(e.target.checked)} />
        Obrigatório escolher ao menos uma opção
      </label>
      <label className="flex items-center gap-2 text-sm text-stone-700">
        <Checkbox checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
        Grupo ativo (disponível para vincular a produtos)
      </label>

      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <Button type="submit" disabled={saving}>
          {saving ? "Salvando..." : group ? "Salvar alterações" : "Criar grupo e adicionar opções"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.push("/admin/adicionais")}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
