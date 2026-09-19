import type { Metadata } from "next";
import { headers } from "next/headers";
import { publicEnv } from "@/lib/env";
import { getCurrentTenantSafe } from "@/lib/tenant";
import { CarrinhoProvider } from "@/lib/carrinho/contexto";
import "./globals.css";

// Multi-tenant: o nome da loja no <title> e na <meta description> depende do
// tenant ativo (slug → tenant.name). Sem `generateMetadata` dinâmico, TODA
// página carrega o nome "Mendes Lanchonete e Padaria" no `<title>` da aba
// do navegador — mesmo em `formiga.automacaojs.us`, etc. É O bug que o
// Isaías reportou em msg 4856 ("hot dog do formiga tá com uns QR code
// do Mendes"). Não era o QR — era o título da aba + branding do login.
export async function generateMetadata(): Promise<Metadata> {
  let tenantName = "Mendes Lanchonete";
  try {
    const t = await getCurrentTenantSafe();
    if (t?.name) tenantName = t.name;
  } catch {
    // Se o tenant não resolve (dev local sem proxy, host inválido), usa
    // o env como fallback. Não queremos 500 só pra ter metadata bonita.
  }
  const host = (await headers()).get("host") ?? "";
  return {
    title: {
      default: tenantName,
      template: `%s — ${tenantName}`,
    },
    description: `Cardápio digital da ${tenantName}. Peça pelo site e receba em casa ou retire no balcão.`,
    // Garante que o Open Graph e Twitter card também usem o nome certo.
    openGraph: {
      title: tenantName,
      description: `Cardápio digital da ${tenantName}`,
      siteName: tenantName,
      url: host ? `https://${host}` : undefined,
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <a
          href="#conteudo"
          className="sr-only-focusable fixed left-2 top-2 z-50 rounded bg-brand-600 px-4 py-2 text-white"
        >
          Pular para o conteúdo
        </a>

        <CarrinhoProvider>{children}</CarrinhoProvider>
      </body>
    </html>
  );
}
