import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { CarrinhoProvider } from "@/lib/carrinho/contexto";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Mendes Lanchonete e Padaria",
  description:
    "Cardápio digital da Mendes Lanchonete e Padaria. Peça pelo site e receba em casa ou retire no balcão.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
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
