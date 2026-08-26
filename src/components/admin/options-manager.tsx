"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { saveOptions } from "@/lib/actions/admin-options";
import { Button } from "@/components/ui/button";
import { Input, Checkbox } from "@/components/ui/field";
import type { ProductOption } from "@/types/database";

type Row = {
  id?: string;
  name: string;
  price_delta: number;
  is_available: boolean;
  sort_order: number;
};

function toRow(option: ProductOption): Row {
  return {
    id: option.id,
    name: option.name,
    price_delta: option.price_delta,
    is_available: option.is_available,
    sort_order: option.sort_order,
  };
}

export function OptionsManager({ groupId, options }: { groupId: string; options: ProductOption[] }) {
  const [rows, setRows] = useState<Row[]>(
    [...options].sort((a, b) => a.sort_order - b.sort_order).map(toRow),
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  function updateRow(index: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function addRow() {
    setRows((prev) => [...prev, { name: "", price_delta: 0, is_available: true, sort_order: prev.length }]);
  }

  function removeRow(index: number) {
    setRows((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSave() {
    setSaving(true);
    setMessage(null);
    const result = await saveOptions(
      groupId,
      rows.filter((row) => row.name.trim() !== "").map((row, index) => ({ ...row, sort_order: index })),
    );
    setSaving(false);
    if (!result.ok) {
      setMessage(result.error);
      return;
    }
    setMessage("Opções salvas com sucesso.");
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {rows.map((row, index) => (
          <div
            key={row.id ?? `novo-${index}`}
            className="flex flex-wrap items-center gap-2 rounded-lg border border-stone-200 p-2"
          >
            <Input
              placeholder="Nome (ex.: Bacon extra)"
              className="h-9 flex-1"
              value={row.name}
              onChange={(e) => updateRow(index, { name: e.target.value })}
            />
            <Input
              type="number"
              step="0.01"
              placeholder="Preço"
              className="h-9 w-28"
              value={row.price_delta}
              onChange={(e) => updateRow(index, { price_delta: Number(e.target.value) })}
            />
            <label className="flex items-center gap-1.5 whitespace-nowrap text-xs text-stone-500">
              <Checkbox
                checked={row.is_available}
                onChange={(e) => updateRow(index, { is_available: e.target.checked })}
              />
              Disponível
            </label>
            <button
              type="button"
              aria-label="Remover opção"
              onClick={() => removeRow(index)}
              className="rounded p-1.5 text-stone-400 hover:bg-red-50 hover:text-red-600"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
        {rows.length === 0 && <p className="text-sm text-stone-500">Nenhuma opção cadastrada ainda.</p>}
      </div>

      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={addRow}>
          <Plus className="h-4 w-4" aria-hidden />
          Adicionar opção
        </Button>
        <Button type="button" size="sm" disabled={saving} onClick={handleSave}>
          {saving ? "Salvando..." : "Salvar opções"}
        </Button>
      </div>

      {message && <p className="text-sm text-stone-700">{message}</p>}
    </div>
  );
}
