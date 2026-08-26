import { SiteHeader } from "@/components/site/header";
import { SiteFooter } from "@/components/site/footer";
import { CarrinhoBar } from "@/components/site/carrinho-bar";

export default function LojaLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main id="conteudo" className="mx-auto w-full max-w-3xl flex-1 px-4 pb-24 pt-4">
        {children}
      </main>
      <CarrinhoBar />
      <SiteFooter />
    </>
  );
}
