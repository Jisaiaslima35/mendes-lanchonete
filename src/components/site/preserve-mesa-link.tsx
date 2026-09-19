"use client";

import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { useMesa } from "@/lib/mesa/contexto";

type Props = Omit<ComponentProps<typeof Link>, "href"> & {
  href: string;
  children: ReactNode;
};

/**
 * Link que preserva o parâmetro `?mesa=X` da sessão do cliente.
 *
 * Usa no lugar de `<Link>` em server pages e em qualquer `<Link>` que
 * precisa carregar a mesa pra próxima rota (mesmo quando a URL atual
 * não tem mais a querystring — o MesaProvider mantém ela viva via
 * localStorage/cookie).
 */
export function PreserveMesaLink({ href, children, ...rest }: Props) {
  const { mesa } = useMesa();
  const finalHref = mesa
    ? `${href}${href.includes("?") ? "&" : "?"}mesa=${encodeURIComponent(mesa)}`
    : href;

  return (
    <Link href={finalHref} {...rest}>
      {children}
    </Link>
  );
}
