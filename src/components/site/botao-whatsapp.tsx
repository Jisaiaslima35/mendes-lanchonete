import { MessageCircle } from "lucide-react";
import { toWhatsAppNumber } from "@/lib/utils";

export function BotaoWhatsApp({ numero, mensagem }: { numero: string; mensagem?: string }) {
  const href = `https://wa.me/${toWhatsAppNumber(numero)}${
    mensagem ? `?text=${encodeURIComponent(mensagem)}` : ""
  }`;

  return (
    <span className="relative inline-flex">
      <span className="absolute -inset-1 animate-pulse-soft rounded-full bg-whatsapp-400 blur-md" aria-hidden />
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="relative inline-flex items-center gap-2 rounded-full bg-whatsapp-500 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-whatsapp-500/30 transition-transform active:scale-95"
      >
        <MessageCircle className="h-5 w-5" aria-hidden />
        Chamar no WhatsApp
      </a>
    </span>
  );
}
