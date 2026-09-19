import QRCode from "qrcode";
import { headers } from "next/headers";
import { resolveTenantOrigin } from "@/lib/tenant-host";
import { getCurrentTenant } from "@/lib/tenant";

// Multi-tenant: a origem do QR Code depende do slug do tenant ativo, que
// só existe em runtime (não é determinístico em build). Sem `dynamic`,
// o Next.js 16 pode tentar cachear a página inteira por rota — mas como
// essa rota é por subdomínio via Host header, o cache é por origem: o
// primeiro acesso via `formiga.automacaojs.us` cachearia o QR com aquele
// slug pra TODOS os subdomínios seguintes. Força render por request.
export const dynamic = "force-dynamic";
export const revalidate = 0;

type MesaQr = {
  mesa: string;
  url: string;
  dataUrl: string;
};

async function buildMesaQr(origin: string, mesa: string): Promise<MesaQr> {
  const url = `${origin}/cardapio?mesa=${encodeURIComponent(mesa)}`;
  const dataUrl = await QRCode.toDataURL(url, {
    width: 360,
    margin: 2,
    color: { dark: "#1c1917", light: "#ffffff" },
  });
  return { mesa, url, dataUrl };
}

export default async function AdminQrCodePage() {
  // Origem dinâmica baseada no tenant ativo (slug + Host header) —
  // garante que o QR aponte para o subdomínio certo
  // (`formiga.automacaojs.us` quando acessado via Formiga,
  // `mendes-teste.automacaojs.us` quando acessado via Mendes, etc.).
  const tenant = await getCurrentTenant();
  const host = (await headers()).get("host");
  const origin = resolveTenantOrigin(host, tenant.slug);
  const geralUrl = `${origin}/cardapio`;

  const [geralDataUrl, ...mesaDataUrls] = await Promise.all([
    QRCode.toDataURL(geralUrl, {
      width: 480,
      margin: 2,
      color: { dark: "#1c1917", light: "#ffffff" },
    }),
    buildMesaQr(origin, "1"),
    buildMesaQr(origin, "2"),
  ]);

  return (
    <div className="max-w-3xl space-y-8">
      <section>
        <h1 className="text-xl font-bold text-stone-900">QR Code do cardápio</h1>
        <p className="mt-1 text-sm text-stone-600">
          Imprima e coloque nas mesas ou na embalagem. Ao escanear, o cliente cai direto no cardápio digital.
        </p>

        <div className="mt-4 rounded-xl border border-stone-200 bg-white p-6 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element -- data URL gerada no servidor, next/image não se aplica */}
          <img src={geralDataUrl} alt={`QR code para ${geralUrl}`} className="mx-auto h-60 w-60" />
          <p className="mt-3 break-all text-xs text-stone-400">{geralUrl}</p>
        </div>

        <a
          href={geralDataUrl}
          download="qrcode-cardapio-mendes.png"
          className="mt-4 inline-flex h-11 items-center justify-center rounded-lg bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700"
        >
          Baixar QR Code (PNG)
        </a>
      </section>

      <section>
        <h2 className="text-lg font-bold text-stone-900">QR Codes para Mesas</h2>
        <p className="mt-1 text-sm text-stone-600">
          Imprima e cole em cada mesa. O cliente escaneia, o cardápio já reconhece a mesa dele — sem taxa de entrega, sem pedir endereço.
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {mesaDataUrls.map((m) => (
            <article
              key={m.mesa}
              className="rounded-xl border border-stone-200 bg-white p-5 text-center"
            >
              <p className="text-xs font-bold uppercase tracking-wide text-brand-700">
                Mesa {m.mesa}
              </p>
              {/* eslint-disable-next-line @next/next/no-img-element -- data URL gerada no servidor, next/image não se aplica */}
              <img
                src={m.dataUrl}
                alt={`QR code Mesa ${m.mesa}`}
                className="mx-auto mt-3 h-48 w-48"
              />
              <p className="mt-3 break-all text-[11px] text-stone-400">{m.url}</p>
              <a
                href={m.dataUrl}
                download={`qrcode-mesa-${m.mesa}-${tenant.slug}.png`}
                className="mt-3 inline-flex h-9 items-center justify-center rounded-lg bg-brand-600 px-3 text-xs font-semibold text-white hover:bg-brand-700"
              >
                Baixar PNG — Mesa {m.mesa}
              </a>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
