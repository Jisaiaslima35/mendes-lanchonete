import { MesaProvider } from "@/lib/mesa/contexto";
import { SiteHeader } from "@/components/site/header";
import { SiteFooter } from "@/components/site/footer";
import { CarrinhoBar } from "@/components/site/carrinho-bar";
import { MesaBanner } from "@/components/site/mesa-banner";
import { HeroBanner } from "@/components/site/hero-banner";

export default function LojaLayout({ children }: { children: React.ReactNode }) {
  return (
    // MesaProvider envolve TUDO (banner, conteúdo, carrinho flutuante) pra
    // que qualquer componente filho leia/escreva a mesa via `useMesa()`.
    // Ele não usa useSearchParams (lê window.location.search direto no
    // useEffect), então não precisa de Suspense boundary.
    <MesaProvider>
      <SiteHeader />
      <main id="conteudo" className="mx-auto w-full max-w-3xl flex-1 px-4 pb-24 pt-4">
        <MesaBanner />
        <HeroBanner />
        {children}
      </main>
      <CarrinhoBar />
      <SiteFooter />
    </MesaProvider>
  );
}
