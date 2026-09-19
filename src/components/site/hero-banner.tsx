import Image from "next/image";
import {
  Clock,
  Bike,
  Store,
  ArrowRight,
  Wallet,
  Banknote,
  QrCode,
} from "lucide-react";
import { getBusinessHours, getSettings } from "@/lib/queries/catalogo";
import { todayHoursLabel } from "@/lib/horario";
import { BotaoWhatsApp } from "@/components/site/botao-whatsapp";
import { PreserveMesaLink } from "@/components/site/preserve-mesa-link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

/**
 * Hero Banner institucional compartilhado entre todas as rotas públicas do cardápio.
 * Renderiza imagem de capa (com fallback), nome da loja, horários de funcionamento,
 * prazos de entrega/retirada, métodos de pagamento aceitos e CTAs rápidos.
 */
export async function HeroBanner() {
  const [settings, hours] = await Promise.all([
    getSettings(),
    getBusinessHours(),
  ]);

  const formasPagamento = [
    settings.payment_pix && { label: "Pix", icon: QrCode },
    settings.payment_cash && { label: "Dinheiro", icon: Banknote },
    settings.payment_card && { label: "Cartão", icon: Wallet },
  ].filter((v): v is { label: string; icon: typeof QrCode } => Boolean(v));

  const bannerSrc =
    settings.banner_url ||
    "https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=1600&q=80";

  return (
    <section className="relative mb-6 overflow-hidden rounded-3xl text-cream-50 shadow-xl shadow-brand-900/15 sm:mb-8">
      {/* Foto de fundo de alta resolução (Unsplash) — banner_url do banco sobrescreve se setado */}
      <div className="absolute inset-0">
        <Image
          src={bannerSrc}
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-center"
        />
        {/* Overlay escuro pra contraste perfeito do texto (esquerda forte → direita leve) */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/60 to-black/30" />
      </div>

      <div className="relative z-10 space-y-4 px-5 py-8 sm:py-10">
        <h1 className="text-2xl font-black leading-tight tracking-tight text-white drop-shadow-md md:text-4xl">
          {settings.business_name}
        </h1>
        <p className="max-w-md text-sm text-stone-200 drop-shadow-sm sm:text-base">
          Sabor de padaria artesanal e lanches feitos na hora. Peça pelo
          cardápio digital.
        </p>

        <div className="flex flex-wrap gap-2 pt-1">
          <Badge
            tone="neutral"
            className="gap-1.5 border border-white/10 bg-black/40 text-white backdrop-blur-sm"
          >
            <Clock className="h-3.5 w-3.5" aria-hidden />{" "}
            {todayHoursLabel(hours)}
          </Badge>
          {settings.accepts_delivery && (
            <Badge
              tone="neutral"
              className="gap-1.5 border border-white/10 bg-black/40 text-white backdrop-blur-sm"
            >
              <Bike className="h-3.5 w-3.5" aria-hidden /> Entrega ~
              {settings.avg_delivery_minutes} min
            </Badge>
          )}
          {settings.accepts_pickup && (
            <Badge
              tone="neutral"
              className="gap-1.5 border border-white/10 bg-black/40 text-white backdrop-blur-sm"
            >
              <Store className="h-3.5 w-3.5" aria-hidden /> Retirada ~
              {settings.avg_pickup_minutes} min
            </Badge>
          )}
        </div>

        {formasPagamento.length > 0 && (
          <div className="flex flex-wrap items-center gap-3 pt-1 text-xs text-stone-200">
            <span>Aceitamos:</span>
            {formasPagamento.map(({ label, icon: Icon }) => (
              <span key={label} className="flex items-center gap-1">
                <Icon className="h-3.5 w-3.5" aria-hidden /> {label}
              </span>
            ))}
          </div>
        )}

        <div className="flex flex-wrap gap-3 pt-3">
          <BotaoWhatsApp
            numero={settings.whatsapp_number}
            mensagem={`Olá! Vim pelo site da ${settings.business_name}.`}
          />
          <PreserveMesaLink href="/cardapio">
            <Button
              variant="secondary"
              size="lg"
              className="border border-white/30 bg-white text-brand-800 shadow-lg shadow-black/30 hover:bg-stone-100"
            >
              Peça agora
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Button>
          </PreserveMesaLink>
        </div>
      </div>
    </section>
  );
}
