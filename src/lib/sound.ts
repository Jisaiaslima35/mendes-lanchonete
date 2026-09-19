/**
 * Alerta sonoro sintetizado via Web Audio API pra avisar o atendente
 * quando chega pedido novo no Kanban /admin/pedidos.
 *
 * Por que Web Audio API e NÃO um .mp3 em /public/sounds/?
 * - 0 KB de bundle / assets — o beep é gerado em runtime (oscilador).
 * - Funciona offline / em redes restritivas (sem servir arquivo estático).
 * - Sem risco de autoplay block: AudioContext é criado/resumido só DEPOIS
 *   do primeiro gesto do usuário (clique/toggle).
 *
 * Política de autoplay dos navegadores (Chrome, Safari, Firefox):
 * - AudioContext criado no carregamento da página fica SUSPENDED até o
 *   usuário interagir com a página. Só pode dar `resume()` dentro de um
 *   handler de evento de input (click, keydown, touchstart).
 * - Solução: o hook expõe `enable()` que é chamado no onClick do toggle.
 *   A partir daí, qualquer `playBeep()` (incluindo via INSERT do realtime)
 *   funciona sem bloqueio.
 */

"use client";

import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";

const STORAGE_KEY = "mendes:sound_alert_enabled";

function subscribe(callback: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("storage", callback);
  window.addEventListener("mendes:sound_change", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("mendes:sound_change", callback);
  };
}

function getSnapshot(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function getServerSnapshot(): boolean {
  return false;
}

/** Beep curto (campainha) — 2 tons pra chamar atenção sem ser irritante. */
function makeBeep(ctx: AudioContext, frequencyHz: number, durationMs: number): void {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = frequencyHz;

  // Envelope ADSR rápido: attack 5ms, decay 50ms, sustain 0, release 50ms.
  // Evita "click" audível no início/fim do tom.
  const now = ctx.currentTime;
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.3, now + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.001, now + durationMs / 1000);

  osc.connect(gain).connect(ctx.destination);
  osc.start(now);
  osc.stop(now + durationMs / 1000);
}

/**
 * Desbloqueia a política de autoplay dos navegadores criando/resumindo
 * o AudioContext no primeiro gesto do usuário ou por chamada explícita.
 */
export async function unlockAudio(ctx?: AudioContext | null): Promise<AudioContext | null> {
  if (typeof window === "undefined") return null;
  let activeCtx = ctx ?? null;
  try {
    if (!activeCtx) {
      const Ctor: typeof AudioContext =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext!;
      activeCtx = new Ctor();
    }
    if (activeCtx.state === "suspended") {
      await activeCtx.resume();
    }
    return activeCtx;
  } catch (err) {
    console.warn("[sound] falha ao desbloquear áudio", err);
    return activeCtx;
  }
}

/**
 * Toca o alerta (2 bipes curtos em frequências diferentes).
 * Se o AudioContext ainda não foi criado/resumido, é no-op silencioso.
 */
export function playOrderAlert(ctx: AudioContext | null): void {
  if (!ctx || ctx.state !== "running") return;
  makeBeep(ctx, 880, 120); // Lá 5
  setTimeout(() => makeBeep(ctx, 1320, 160), 140); // Mi 6 — segunda nota mais aguda
}

/**
 * Hook React que gerencia o estado do alerta sonoro:
 * - `enabled` (boolean) — lido de forma reativa com useSyncExternalStore
 * - `enable()` / `disable()` — toggle com persistência e desbloqueio
 * - `unlockAudio()` — desbloqueia áudio para contornar autoplay policy
 * - `ctxRef.current` — AudioContext pronto pra chamar playOrderAlert
 */
export function useOrderAlertSound() {
  const enabled = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const ctxRef = useRef<AudioContext | null>(null);

  const unlock = useCallback(async () => {
    ctxRef.current = await unlockAudio(ctxRef.current);
    return ctxRef.current;
  }, []);

  // Registra ouvinte automático de primeiro gesto no document para desbloquear autoplay
  // caso o alerta já esteja ativado no localStorage.
  useEffect(() => {
    if (!enabled) return;

    const handleFirstGesture = async () => {
      await unlock();
      window.removeEventListener("click", handleFirstGesture);
      window.removeEventListener("keydown", handleFirstGesture);
      window.removeEventListener("touchstart", handleFirstGesture);
    };

    window.addEventListener("click", handleFirstGesture, { passive: true });
    window.addEventListener("keydown", handleFirstGesture, { passive: true });
    window.addEventListener("touchstart", handleFirstGesture, { passive: true });

    return () => {
      window.removeEventListener("click", handleFirstGesture);
      window.removeEventListener("keydown", handleFirstGesture);
      window.removeEventListener("touchstart", handleFirstGesture);
    };
  }, [enabled, unlock]);

  const enable = useCallback(async () => {
    await unlock();
    try {
      localStorage.setItem(STORAGE_KEY, "1");
      window.dispatchEvent(new Event("mendes:sound_change"));
    } catch {
      /* ignore */
    }
    if (ctxRef.current) {
      playOrderAlert(ctxRef.current);
    }
  }, [unlock]);

  const disable = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY, "0");
      window.dispatchEvent(new Event("mendes:sound_change"));
    } catch {
      /* ignore */
    }
  }, []);

  // Cleanup: fecha AudioContext quando o componente desmonta.
  useEffect(() => {
    return () => {
      try {
        ctxRef.current?.close();
      } catch {
        /* ignore */
      }
      ctxRef.current = null;
    };
  }, []);

  return { enabled, enable, disable, ctxRef, unlockAudio: unlock };
}
