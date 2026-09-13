"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useCarrinho } from "@/lib/carrinho/contexto";
import { submitCheckout } from "@/lib/actions/checkout";
import { resolveDeliveryFee, cartTotal } from "@/lib/precos";
import { formatCurrency, formatPhone, formatZip, onlyDigits } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea, FieldGroup, FieldError } from "@/components/ui/field";
import type { Neighborhood, Settings } from "@/types/database";

type DeliveryQuoteClient = {
  ok: boolean;
  source: "distance" | "neighborhood" | "fallback";
  address: {
    cep: string;
    logradouro: string;
    bairro: string;
    cidade: string;
    uf: string;
  } | null;
  distance_km: number | null;
  delivery_fee: number;
  reason?: string;
};

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
  const [email, setEmail] = useState("");
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

  // === Cálculo de frete por distância (Haversine) ===
  // Preenchido ao sair do campo CEP (8 dígitos). Volumoso porque
  // precisa disparar o fetch quando o cara terminar de digitar.
  const [quote, setQuote] = useState<DeliveryQuoteClient | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const quoteAbortRef = useRef<AbortController | null>(null);

  // Cidade/UF exibidas no resumo (NÃO vão pro pedido — só pra conveniência).
  const [cityDisplay, setCityDisplay] = useState<string | null>(null);

  // Dispara o lookup quando o CEP atinge 8 dígitos. Não dispara ao montar.
  useEffect(() => {
    if (fulfillment !== "delivery") return;
    const cepDigits = onlyDigits(zip);
    if (cepDigits.length !== 8) {
      // CEP incompleto → reseta tudo que veio de lookup anterior.
      setQuote(null);
      setQuoteError(null);
      setCityDisplay(null);
      return;
    }

    setQuoteLoading(true);
    setQuoteError(null);

    quoteAbortRef.current?.abort();
    const ctrl = new AbortController();
    quoteAbortRef.current = ctrl;

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/delivery/quote?cep=${encodeURIComponent(cepDigits)}`,
          { signal: ctrl.signal, cache: "no-store" },
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as DeliveryQuoteClient;
        if (ctrl.signal.aborted) return;
        setQuote(data);
        // Auto-preencher rua/bairro se o cliente deixou vazio
        // (não sobrescreve se ele já digitou algo — usa fallback via flag).
        if (data.address?.logradouro && !street) setStreet(data.address.logradouro);
        if (data.address?.bairro && !neighborhoodId) {
          // tenta casar com um bairro do <select>
          const match = neighborhoods.find(
            (n) => n.name.trim().toLowerCase() === data.address!.bairro.trim().toLowerCase(),
          );
          if (match) setNeighborhoodId(match.id);
        }
        if (data.address?.cidade) setCityDisplay(`${data.address.cidade}/${data.address.uf}`);
      } catch (err) {
        if (ctrl.signal.aborted) return;
        setQuote(null);
        setQuoteError(
          err instanceof Error ? err.message : "Falha ao calcular o frete. Usaremos taxa padrão.",
        );
      } finally {
        if (!ctrl.signal.aborted) setQuoteLoading(false);
      }
    }, 350); // debounce — espera o cara parar de digitar

    return () => clearTimeout(timer);
    // não precisamos re-rodar se `street`/`neighborhoodId` mudarem — só CEP e modo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zip, fulfillment]);

  const selectedNeighborhood = neighborhoods.find((n) => n.id === neighborhoodId) ?? null;

  // === Regra de preço do frete (Mendes v1) ===
  //   1. CEP válido + lookup OK → usa `delivery_fee` da quote (cap R$4 já aplicado)
  //   2. CEP completo mas lookup caiu em fallback → usa o `delivery_fee` retornado
  //      (R$3, ou seja o que o servidor decidir)
  //   3. CEP vazio/incompleto → tabela do bairro (legado)
  const fallbackDeliveryFee = resolveDeliveryFee(
    selectedNeighborhood,
    settings,
    subtotal,
  );
  const cepReady = fulfillment === "delivery" && onlyDigits(zip).length === 8;
  const quoteApplies = cepReady && quote != null;
  const deliveryFee =
    fulfillment === "delivery"
      ? quoteApplies
        ? quote.delivery_fee
        : fallbackDeliveryFee
      : 0;
  const total = useMemo(
    () => cartTotal({ subtotal, deliveryFee, discount: 0 }),
    [subtotal, deliveryFee],
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    setSubmitting(true);
    const result = await submitCheckout({
      fulfillment,
      customerName: name,
      customerPhone: phone,
      customerEmail: email,
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
  setError(result.error);
  setFieldErrors(result.fieldErrors ?? {});
  return;
}

if (paymentMethod === "pix") {
  console.log("DADOS PIX:", {
  orderId: result.data.orderId,
  customerEmail: result.data.customerEmail,
});

  const paymentResponse = await fetch("/api/pagamentos/pix", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      orderId: result.data.orderId,
      amount: 0,
      payer: {
        email: result.data.customerEmail,
      },
    }),
  });

  const paymentData = await paymentResponse.json();

  if (!paymentResponse.ok) {
    setError(paymentData.error ?? "Não foi possível gerar o Pix.");
    setSubmitting(false);
    return;
  }

  console.log("PIX MERCADO PAGO:", paymentData);
}
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
          <FieldGroup>
  <Label htmlFor="email" required>
    E-mail
  </Label>
  <Input
    id="email"
    type="email"
    required
    placeholder="seuemail@gmail.com"
    value={email}
    onChange={(e) => setEmail(e.target.value)}
  />
</FieldGroup>
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
            <p className="text-xs text-stone-500">
              Ao informar o CEP, calculamos o frete com base na distância. Teto: R$ 4,00.
            </p>
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
          <div className="flex items-center justify-between text-sm text-stone-600">
            <span>
              Entrega
              {quoteApplies && quote?.ok && quote.distance_km != null && (
                <span className="ml-1 text-xs text-stone-500">
                  ({quote.distance_km.toFixed(1)} km)
                </span>
              )}
            </span>
            <span className="inline-flex items-center gap-2">
              {quoteLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-stone-400" />}
              {deliveryFee > 0 ? formatCurrency(deliveryFee) : "Grátis"}
            </span>
          </div>
        )}
        {fulfillment === "delivery" && cityDisplay && (
          <p className="text-xs text-stone-500">Entregando em {cityDisplay}</p>
        )}
        {fulfillment === "delivery" && quoteError && (
          <p className="text-xs text-amber-700">{quoteError}</p>
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
  {submitting ? "Enviando pedido..." : "Finalizar pedido"}
</Button>
    </form>
  );
}
