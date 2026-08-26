"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createNeighborhood, updateNeighborhood } from "@/lib/actions/admin-neighborhoods";
import { Button } from "@/components/ui/button";
import { Input, Label, FieldGroup, FieldError, Checkbox } from "@/components/ui/field";
import type { Neighborhood } from "@/types/database";

export function NeighborhoodForm({ neighborhood }: { neighborhood?: Neighborhood }) {
  const router = useRouter();
  const [name, setName] = useState(neighborhood?.name ?? "");
  const [city, setCity] = useState(neighborhood?.city ?? "");
  const [deliveryFee, setDeliveryFee] = useState(neighborhood?.delivery_fee ?? 0);
  const [minOrderValue, setMinOrderValue] = useState(neighborhood?.min_order_value ?? 0);
  const [freeDeliveryThreshold, setFreeDeliveryThreshold] = useState(
    neighborhood?.free_delivery_threshold != null ? String(neighborhood.free_delivery_threshold) : "",
  );
  const [estimatedMinutes, setEstimatedMinutes] = useState(neighborhood?.estimated_minutes ?? 40);
  const [isActive, setIsActive] = useState(neighborhood?.is_active ?? true);
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
      city,
      delivery_fee: deliveryFee,
      min_order_value: minOrderValue,
      free_delivery_threshold: freeDeliveryThreshold === "" ? null : Number(freeDeliveryThreshold),
      estimated_minutes: estimatedMinutes,
      is_active: isActive,
    };

    const result = neighborhood
      ? await updateNeighborhood(neighborhood.id, payload)
      : await createNeighborhood(payload);
    setSaving(false);

    if (!result.ok) {
      setError(result.error);
      setFieldErrors(result.fieldErrors ?? {});
      return;
    }
    router.push("/admin/bairros");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-lg space-y-4" noValidate>
      <FieldGroup>
        <Label htmlFor="name" required>
          Nome do bairro
        </Label>
        <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} />
        <FieldError message={fieldErrors.name?.[0]} />
      </FieldGroup>

      <FieldGroup>
        <Label htmlFor="city">Cidade</Label>
        <Input id="city" value={city ?? ""} onChange={(e) => setCity(e.target.value)} />
      </FieldGroup>

      <div className="grid grid-cols-2 gap-3">
        <FieldGroup className="mb-0">
          <Label htmlFor="delivery_fee" required>
            Taxa de entrega (R$)
          </Label>
          <Input
            id="delivery_fee"
            type="number"
            step="0.01"
            min={0}
            required
            value={deliveryFee}
            onChange={(e) => setDeliveryFee(Number(e.target.value))}
          />
        </FieldGroup>
        <FieldGroup className="mb-0">
          <Label htmlFor="estimated_minutes">Tempo estimado (min)</Label>
          <Input
            id="estimated_minutes"
            type="number"
            min={0}
            value={estimatedMinutes}
            onChange={(e) => setEstimatedMinutes(Number(e.target.value))}
          />
        </FieldGroup>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <FieldGroup className="mb-0">
          <Label htmlFor="min_order_value">Pedido mínimo para este bairro (R$)</Label>
          <Input
            id="min_order_value"
            type="number"
            step="0.01"
            min={0}
            value={minOrderValue}
            onChange={(e) => setMinOrderValue(Number(e.target.value))}
          />
        </FieldGroup>
        <FieldGroup className="mb-0">
          <Label htmlFor="free_delivery_threshold">Entrega grátis a partir de (R$)</Label>
          <Input
            id="free_delivery_threshold"
            type="number"
            step="0.01"
            min={0}
            placeholder="Usar padrão da loja"
            value={freeDeliveryThreshold}
            onChange={(e) => setFreeDeliveryThreshold(e.target.value)}
          />
        </FieldGroup>
      </div>

      <label className="flex items-center gap-2 text-sm text-stone-700">
        <Checkbox checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
        Bairro atendido (aparece no checkout)
      </label>

      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <Button type="submit" disabled={saving}>
          {saving ? "Salvando..." : neighborhood ? "Salvar alterações" : "Criar bairro"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.push("/admin/bairros")}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
