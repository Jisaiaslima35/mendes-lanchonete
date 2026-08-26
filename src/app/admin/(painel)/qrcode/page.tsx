import QRCode from "qrcode";
import { publicEnv } from "@/lib/env";

export default async function AdminQrCodePage() {
  const url = `${publicEnv.siteUrl}/cardapio`;
  const dataUrl = await QRCode.toDataURL(url, {
    width: 480,
    margin: 2,
    color: { dark: "#1c1917", light: "#ffffff" },
  });

  return (
    <div className="max-w-md space-y-4">
      <h1 className="text-xl font-bold text-stone-900">QR Code do cardápio</h1>
      <p className="text-sm text-stone-600">
        Imprima e coloque nas mesas ou na embalagem. Ao escanear, o cliente cai direto no cardápio digital.
      </p>

      <div className="rounded-xl border border-stone-200 bg-white p-6 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element -- data URL gerada no servidor, next/image não se aplica */}
        <img src={dataUrl} alt={`QR code para ${url}`} className="mx-auto h-60 w-60" />
        <p className="mt-3 break-all text-xs text-stone-400">{url}</p>
      </div>

      <a
        href={dataUrl}
        download="qrcode-cardapio-mendes.png"
        className="inline-flex h-11 items-center justify-center rounded-lg bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700"
      >
        Baixar QR Code (PNG)
      </a>
    </div>
  );
}
