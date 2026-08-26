"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useCarrinho } from "@/lib/carrinho/contexto";
import { submitCheckout } from "@/lib/actions/checkout";
import { resolveDeliveryFee, cartTotal } from "@/lib/precos";
import { formatCurrency, formatPhone, formatZip, onlyDigits } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea, FieldGroup, FieldError } from "@/components/ui/field";
import type { Neighborhood, Settings } from "@/types/database";

export function CheckoutForm({
  settings,
  neighborhoods,
}: {
  settings: Settings;
  neighborhoods: Neighborhood[];
}) {
  const router = useRouter();
  const { itens, subtotal, limparCarrinho } = useCarrinho();

  const [fulfillment, setFulfillment] = useState<"delivery" | "pickup">(
    settings.accepts_delivery ? "delivery" : "pickup",
  );
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [zip, setZip] = useState("");
  const [street, setStreet] = useState("");
  const [number, setNumber] = useState("");
  const [complement, setComplement] = useState("");
  const [neighborhoodId, setNeighborhoodId] = useState("");
  const [reference, setReference] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"pix" | "cash" | "card">(
    settings.payment_pix ? "pix" : settings.payment_cash ? "cash" : "card",
  );
  const [wantsChange, setWantsChange] = useState(false);
  const [changeFor, setChangeFor] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  const selectedNeighborhood = neighborhoods.find((n) => n.id === neighborhoodId) ?? null;
  const deliveryFee =
    fulfillment === "delivery" ? resolveDeliveryFee(selectedNeighborhood, settings, subtotal) : 0;
  const total = useMemo(
    () => cartTotal({ subtotal, deliveryFee, discount: 0 }),
    [subtotal, deliveryFee],
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    const whatsappWindow = window.open("", "_blank");

    setSubmitting(true);
    const result = await submitCheckout({
      fulfillment,
      customerName: name,
      customerPhone: phone,
      address:
        fulfillment === "delivery"
          ? {
              zip,
              street,
              number,
              complement: complement || undefined,
              district: selectedNeighborhood?.name ?? "",
              reference: reference || undefined,
              neighborhoodId,
            }
          : undefined,
      paymentMethod,
      changeFor: paymentMethod === "cash" && wantsChange ? Number(changeFor) : undefined,
      notes: notes || undefined,
      items: itens.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        optionIds: item.options.map((o) => o.id),
        notes: item.notes,
      })),
    });
    setSubmitting(false);

    if (!result.ok) {
      whatsappWindow?.close();
      setError(result.error);
      setFieldErrors(result.fieldErrors ?? {});
      return;
    }

    if (whatsappWindow) whatsappWindow.location.href = result.data.whatsappUrl;
    limparCarrinho();
    router.push(`/pedido/${result.data.publicToken}`);
  }

  if (itens.length === 0) {
    return <p className="text-stone-600">Seu carrinho está vazio.</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 pb-8" noValidate>
      <fieldset className="space-y-2">
        <legend className="mb-1 font-semibold text-brand-900">Como você quer receber?</legend>
        <div className="grid grid-cols-2 gap-2">
          {settings.accepts_delivery && (
            <label className="flex items-center justify-center rounded-lg border border-stone-300 px-3 py-2.5 has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50">
              <input
                type="radio"
                name="fulfillment"
                className="sr-only"
                checked={fulfillment === "delivery"}
                onChange={() => setFulfillment("delivery")}
              />
              Entrega
            </label>
          )}
          {settings.accepts_pickup && (
            <label className="flex items-center justify-center rounded-lg border border-stone-300 px-3 py-2.5 has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50">
              <input
                type="radio"
                name="fulfillment"
                className="sr-only"
                checked={fulfillment === "pickup"}
                onChange={() => setFulfillment("pickup")}
              />
              Retirada
            </label>
          )}
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="mb-1 font-semibold text-brand-900">Seus dados</legend>
        <FieldGroup>
          <Label htmlFor="name" required>
            Nome
          </Label>
          <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} />
          <FieldError message={fieldErrors.customerName?.[0]} />
        </FieldGroup>
        <FieldGroup>
          <Label htmlFor="phone" required>
            Telefone (WhatsApp)
          </Label>
          <Input
            id="phone"
            required
            inputMode="numeric"
            placeholder="(11) 99999-9999"
            value={formatPhone(phone)}
            onChange={(e) => setPhone(onlyDigits(e.target.value))}
          />
          <FieldError message={fieldErrors.customerPhone?.[0]} />
        </FieldGroup>
      </fieldset>

      {fulfillment === "delivery" && (
        <fieldset className="space-y-3">
          <legend className="mb-1 font-semibold text-brand-900">Endereço de entrega</legend>
          <FieldGroup>
            <Label htmlFor="zip" required>
              CEP
            </Label>
            <Input
              id="zip"
              required
              inputMode="numeric"
              value={formatZip(zip)}
              onChange={(e) => setZip(onlyDigits(e.target.value))}
            />
          </FieldGroup>
          <div className="grid grid-cols-3 gap-3">
            <FieldGroup className="col-span-2">
              <Label htmlFor="street" required>
                Rua
              </Label>
              <Input id="street" required value={street} onChange={(e) => setStreet(e.target.value)} />
            </FieldGroup>
            <FieldGroup>
              <Label htmlFor="number" required>
                Número
              </Label>
              <Input id="number" required value={number} onChange={(e) => setNumber(e.target.value)} />
            </FieldGroup>
          </div>
          <FieldGroup>
            <Label htmlFor="complement">Complemento</Label>
            <Input id="complement" value={complement} onChange={(e) => setComplement(e.target.value)} />
          </FieldGroup>
          <FieldGroup>
            <Label htmlFor="neighborhood" required>
              Bairro
            </Label>
            <Select
              id="neighborhood"
              required
              value={neighborhoodId}
              onChange={(e) => setNeighborhoodId(e.target.value)}
            >
              <option value="">Selecione seu bairro</option>
              {neighborhoods.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.name} — {n.delivery_fee > 0 ? formatCurrency(n.delivery_fee) : "grátis"}
                </option>
              ))}
            </Select>
            <FieldError message={fieldErrors["address.neighborhoodId"]?.[0]} />
          </FieldGroup>
          <FieldGroup>
            <Label htmlFor="reference">Ponto de referência</Label>
            <Input id="reference" value={reference} onChange={(e) => setReference(e.target.value)} />
          </FieldGroup>
        </fieldset>
      )}

      <fieldset className="space-y-2">
        <legend className="mb-1 font-semibold text-brand-900">Pagamento</legend>
        <div className="grid grid-cols-3 gap-2">
          {settings.payment_pix && (
            <label className="flex items-center justify-center rounded-lg border border-stone-300 px-2 py-2.5 text-sm has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50">
              <input
                type="radio"
                name="payment"
                className="sr-only"
                checked={paymentMethod === "pix"}
                onChange={() => setPaymentMethod("pix")}
              />
              Pix
            </label>
          )}
          {settings.payment_cash && (
            <label className="flex items-center justify-center rounded-lg border border-stone-300 px-2 py-2.5 text-sm has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50">
              <input
                type="radio"
                name="payment"
                className="sr-only"
                checked={paymentMethod === "cash"}
                onChange={() => setPaymentMethod("cash")}
              />
              Dinheiro
            </label>
          )}
          {settings.payment_card && (
            <label className="flex items-center justify-center rounded-lg border border-stone-300 px-2 py-2.5 text-sm has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50">
              <input
                type="radio"
                name="payment"
                className="sr-only"
                checked={paymentMethod === "card"}
                onChange={() => setPaymentMethod("card")}
              />
              Cartão
            </label>
          )}
        </div>

        {paymentMethod === "cash" && (
          <div className="space-y-2 pt-1">
            <label className="flex items-center gap-2 text-sm text-stone-700">
              <input
                type="checkbox"
                checked={wantsChange}
                onChange={(e) => setWantsChange(e.target.checked)}
                className="h-4 w-4"
              />
              Preciso de troco
            </label>
            {wantsChange && (
              <FieldGroup>
                <Label htmlFor="changeFor">Troco para quanto?</Label>
                <Input
                  id="changeFor"
                  inputMode="decimal"
                  placeholder="Ex.: 50"
                  value={changeFor}
                  onChange={(e) => setChangeFor(e.target.value)}
                />
              </FieldGroup>
            )}
          </div>
        )}
      </fieldset>

      <FieldGroup>
        <Label htmlFor="orderNotes">Observações do pedido</Label>
        <Textarea id="orderNotes" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </FieldGroup>

      <div className="space-y-1 rounded-xl border border-stone-200 bg-white p-4">
        <div className="flex justify-between text-sm text-stone-600">
          <span>Subtotal</span>
          <span>{formatCurrency(subtotal)}</span>
        </div>
        {fulfillment === "delivery" && (
          <div className="flex justify-between text-sm text-stone-600">
            <span>Entrega</span>
            <span>{deliveryFee > 0 ? formatCurrency(deliveryFee) : "Grátis"}</span>
          </div>
        )}
        <div className="flex justify-between pt-1 font-bold text-brand-900">
          <span>Total</span>
          <span>{formatCurrency(total)}</span>
        </div>
      </div>

      {error && (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <Button type="submit" size="lg" className="w-full" disabled={submitting}>
        {submitting ? "Enviando pedido..." : "Confirmar pedido pelo WhatsApp"}
      </Button>
    </form>
  );
}
