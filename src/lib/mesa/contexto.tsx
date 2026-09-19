"use client";

/**
 * MesaProvider — fonte única da verdade da mesa do cliente.
 *
 * Por que existe: o cliente escaneia um QR Code que abre a loja com
 * `?mesa=1` na URL. Mas qualquer navegação via `<Link>` (incluindo o
 * botão "voltar" do navegador) pode descartar a querystring. Pra que
 * a mesa persista entre TODAS as rotas, gravamos ela no cliente
 * (localStorage + cookie) assim que aparece na URL, e lemos de volta
 * quando necessário.
 *
 * Prioridade de resolução (mais recente vence):
 *   1. URL `?mesa=X` (scan novo do QR)
 *   2. Cookie `mendes_mesa`
 *   3. localStorage `mendes:mesa:v1`
 *   4. null
 *
 * Importante: NÃO usa `useSearchParams` — lê a URL via
 * `window.location.search` dentro de useEffect. Isso evita o requisito
 * de Suspense boundary do Next 16 (que só se aplica a hooks).
 *
 * Hidratação: mesmo padrão do carrinho (linhas 60–91 de
 * `src/lib/carrinho/contexto.tsx`) — useState vazio + useEffect após
 * `useSyncExternalStore(semInscricao, () => true, () => false)`.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";

const STORAGE_KEY = "mendes:mesa:v1";
const COOKIE_NAME = "mendes_mesa";
const COOKIE_MAX_AGE = 7200; // 2h — passa o pedido médio sem travar storage
// Defesa contra cookie/URL poisoning: mesa só pode ter letras, números e hífen.
const MESA_RE = /^[A-Za-z0-9-]{1,20}$/;

function sanitize(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const t = raw.trim();
  return MESA_RE.test(t) ? t : null;
}

function readCookie(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(
    new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]+)`),
  );
  return match ? sanitize(decodeURIComponent(match[1])) : null;
}

function writeCookie(mesa: string | null): void {
  if (typeof document === "undefined") return;
  if (mesa == null) {
    // max-age=0 sobrescreve (alguns browsers ignoram `delete`).
    document.cookie = `${COOKIE_NAME}=; path=/; max-age=0; samesite=lax`;
  } else {
    document.cookie =
      `${COOKIE_NAME}=${encodeURIComponent(mesa)}; path=/; max-age=${COOKIE_MAX_AGE}; samesite=lax`;
  }
}

function readLocal(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return sanitize(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return null;
  }
}

function writeLocal(mesa: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (mesa == null) window.localStorage.removeItem(STORAGE_KEY);
    else window.localStorage.setItem(STORAGE_KEY, mesa);
  } catch {
    // localStorage indisponível (modo privado, storage cheio, etc.) — silencioso.
  }
}

function readUrlMesa(): string | null {
  if (typeof window === "undefined") return null;
  return sanitize(new URLSearchParams(window.location.search).get("mesa"));
}

const semInscricao = () => () => {};
function useIsHidratado(): boolean {
  return useSyncExternalStore(semInscricao, () => true, () => false);
}

type MesaContextValue = {
  mesa: string | null;
  isHidratado: boolean;
  setMesa: (v: string) => void;
  clearMesa: () => void;
};

const MesaContext = createContext<MesaContextValue | null>(null);

export function MesaProvider({ children }: { children: ReactNode }) {
  const isHidratado = useIsHidratado();
  const [mesaStorage, setMesaStorage] = useState<string | null>(null);
  const carregouRef = useRef(false);

  // 1. Carrega do storage uma vez, após hidratação.
  useEffect(() => {
    if (!isHidratado || carregouRef.current) return;
    carregouRef.current = true;
    // URL tem prioridade sobre cookie/storage no carregamento inicial.
    setMesaStorage(readUrlMesa() ?? readCookie() ?? readLocal());
  }, [isHidratado]);

  // 2. Reage a mudanças de URL (back/forward do navegador, navegação client-side).
  useEffect(() => {
    if (!isHidratado) return;

    const sync = () => {
      const fromUrl = readUrlMesa();
      if (fromUrl) {
        setMesaStorage(fromUrl);
        writeCookie(fromUrl);
        writeLocal(fromUrl);
      }
      // Se a URL não tem mesa mas o storage tem, mantém o storage
      // (cliente navegou pra uma rota "limpa" mas o pedido tá em andamento).
    };

    window.addEventListener("popstate", sync);

    // Patch do history.pushState pra capturar navegação client-side do Next.
    const origPush = history.pushState.bind(history);
    const origReplace = history.replaceState.bind(history);
    history.pushState = function (...args: Parameters<typeof origPush>) {
      const ret = origPush(...args);
      sync();
      return ret;
    };
    history.replaceState = function (...args: Parameters<typeof origReplace>) {
      const ret = origReplace(...args);
      sync();
      return ret;
    };

    return () => {
      window.removeEventListener("popstate", sync);
      history.pushState = origPush;
      history.replaceState = origReplace;
    };
  }, [isHidratado]);

  const setMesa = useCallback((v: string) => {
    const s = sanitize(v);
    if (!s) return;
    setMesaStorage(s);
    writeCookie(s);
    writeLocal(s);
  }, []);

  const clearMesa = useCallback(() => {
    setMesaStorage(null);
    writeCookie(null);
    writeLocal(null);
  }, []);

  const value = useMemo(
    () => ({ mesa: mesaStorage, isHidratado, setMesa, clearMesa }),
    [mesaStorage, isHidratado, setMesa, clearMesa],
  );

  return <MesaContext.Provider value={value}>{children}</MesaContext.Provider>;
}

export function useMesa(): MesaContextValue {
  const ctx = useContext(MesaContext);
  if (!ctx) throw new Error("useMesa deve ser usado dentro de MesaProvider.");
  return ctx;
}
