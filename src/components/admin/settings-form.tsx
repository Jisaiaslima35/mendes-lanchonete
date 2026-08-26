"use client";

import { useState } from "react";
import { updateSettings, updateBusinessHours } from "@/lib/actions/admin-settings";
import { formatPhone, onlyDigits, trimSeconds } from "@/lib/utils";
import { WEEKDAY_NAMES } from "@/lib/horario";
import { Button } from "@/components/ui/button";
import { Input, Label, FieldGroup, Checkbox } from "@/components/ui/field";
import type { BusinessHour, Settings } from "@/types/database";

export function SettingsForm({
  settings,
  hours,
}: {
  settings: Settings;
  hours: BusinessHour[];
}) {
  const [form, setForm] = useState(settings);
  const [rows, setRows] = useState(
    Array.from({ length: 7 }, (_, weekday) => {
      const existing = hours.find((h) => h.weekday === weekday);
      return existing
        ? { ...existing, opens_at: trimSeconds(existing.opens_at), closes_at: trimSeconds(existing.closes_at) }
        : {
            id: undefined as string | undefined,
            weekday,
            opens_at: "18:00",
            closes_at: "23:00",
            is_closed: true,
          };
    }),
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  function setField<K extends keyof Settings>(key: K, value: Settings[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    const [settingsResult, hoursResult] = await Promise.all([
      updateSettings(form),
      updateBusinessHours(rows),
    ]);

    setSaving(false);
    if (!settingsResult.ok) {
      setMessage(settingsResult.error);
      return;
    }
    if (!hoursResult.ok) {
      setMessage(hoursResult.error);
      return;
    }
    setMessage("Configurações salvas com sucesso.");
  }

  return (
    <form onSubmit={handleSave} className="space-y-8" noValidate>
      <section className="space-y-3 rounded-xl border border-stone-200 bg-white p-4">
        <h2 className="font-semibold text-stone-900">Loja</h2>
        <label className="flex items-center gap-2 text-sm text-stone-700">
          <Checkbox
            checked={form.manual_closed}
            onChange={(e) => setField("manual_closed", e.target.checked)}
          />
          Fechar a loja agora (sobrepõe o horário de funcionamento)
        </label>
        <FieldGroup>
          <Label htmlFor="business_name">Nome do estabelecimento</Label>
          <Input
            id="business_name"
            value={form.business_name}
            onChange={(e) => setField("business_name", e.target.value)}
          />
        </FieldGroup>
        <FieldGroup>
          <Label htmlFor="whatsapp_number">Número do WhatsApp para receber pedidos</Label>
          <Input
            id="whatsapp_number"
            inputMode="numeric"
            value={formatPhone(form.whatsapp_number)}
            onChange={(e) => setField("whatsapp_number", onlyDigits(e.target.value))}
          />
        </FieldGroup>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex items-center gap-2 text-sm text-stone-700">
            <Checkbox
              checked={form.accepts_delivery}
              onChange={(e) => setField("accepts_delivery", e.target.checked)}
            />
            Aceita entrega
          </label>
          <label className="flex items-center gap-2 text-sm text-stone-700">
            <Checkbox
              checked={form.accepts_pickup}
              onChange={(e) => setField("accepts_pickup", e.target.checked)}
            />
            Aceita retirada
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <FieldGroup className="mb-0">
            <Label htmlFor="min_order_value">Pedido mínimo (R$)</Label>
            <Input
              id="min_order_value"
              type="number"
              step="0.01"
              value={form.min_order_value}
              onChange={(e) => setField("min_order_value", Number(e.target.value))}
            />
          </FieldGroup>
          <FieldGroup className="mb-0">
            <Label htmlFor="free_delivery_threshold">Entrega grátis a partir de (R$)</Label>
            <Input
              id="free_delivery_threshold"
              type="number"
              step="0.01"
              value={form.free_delivery_threshold ?? ""}
              onChange={(e) =>
                setField(
                  "free_delivery_threshold",
                  e.target.value === "" ? null : Number(e.target.value),
                )
              }
            />
          </FieldGroup>
        </div>
      </section>

      <section className="space-y-3 rounded-xl border border-stone-200 bg-white p-4">
        <h2 className="font-semibold text-stone-900">Pagamento</h2>
        <div className="grid grid-cols-3 gap-3">
          <label className="flex items-center gap-2 text-sm text-stone-700">
            <Checkbox checked={form.payment_pix} onChange={(e) => setField("payment_pix", e.target.checked)} />
            Pix
          </label>
          <label className="flex items-center gap-2 text-sm text-stone-700">
            <Checkbox checked={form.payment_cash} onChange={(e) => setField("payment_cash", e.target.checked)} />
            Dinheiro
          </label>
          <label className="flex items-center gap-2 text-sm text-stone-700">
            <Checkbox checked={form.payment_card} onChange={(e) => setField("payment_card", e.target.checked)} />
            Cartão
          </label>
        </div>
      </section>

      <section className="space-y-3 rounded-xl border border-stone-200 bg-white p-4">
        <h2 className="font-semibold text-stone-900">Horário de funcionamento</h2>
        <div className="space-y-2">
          {rows.map((row, i) => (
            <div key={row.weekday} className="flex items-center gap-3">
              <span className="w-28 shrink-0 text-sm text-stone-700">{WEEKDAY_NAMES[row.weekday]}</span>
              <label className="flex items-center gap-1.5 text-xs text-stone-500">
                <Checkbox
                  checked={!row.is_closed}
                  onChange={(e) =>
                    setRows((r) => r.map((x, idx) => (idx === i ? { ...x, is_closed: !e.target.checked } : x)))
                  }
                />
                Aberto
              </label>
              {!row.is_closed && (
                <>
                  <Input
                    type="time"
                    className="h-9 w-28"
                    value={trimSeconds(row.opens_at)}
                    onChange={(e) =>
                      setRows((r) => r.map((x, idx) => (idx === i ? { ...x, opens_at: e.target.value } : x)))
                    }
                  />
                  <span className="text-stone-400">até</span>
                  <Input
                    type="time"
                    className="h-9 w-28"
                    value={trimSeconds(row.closes_at)}
                    onChange={(e) =>
                      setRows((r) => r.map((x, idx) => (idx === i ? { ...x, closes_at: e.target.value } : x)))
                    }
                  />
                </>
              )}
            </div>
          ))}
        </div>
      </section>

      {message && <p className="text-sm text-stone-700">{message}</p>}

      <Button type="submit" disabled={saving}>
        {saving ? "Salvando..." : "Salvar configurações"}
      </Button>
    </form>
  );
}
