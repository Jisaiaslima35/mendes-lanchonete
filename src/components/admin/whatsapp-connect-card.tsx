"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import {
  MessageCircle,
  Power,
  RefreshCw,
  Smartphone,
  Wifi,
  WifiOff,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  disconnectEvolution,
  provisionEvolution,
  recreateEvolution,
  refreshEvolutionQr,
} from "@/lib/actions/admin-evolution";
import { normalizeQrSrc } from "@/lib/qr";

type EvolutionState = "open" | "close" | "connecting";

type Initial = {
  evolution_instance_name: string | null;
  evolution_state: EvolutionState | null;
  evolution_owner_jid: string | null;
  evolution_connected_at: string | null;
  evolution_webhook_set: boolean;
};

type Snapshot = {
  state: EvolutionState;
  qrcode?: string;
  ownerJid?: string | null;
  webhookPending?: boolean;
};

/**
 * Formata um JID do WhatsApp (ex: "5584996327329:53@s.whatsapp.net") em
 * um número legível pro display (ex: "+55 (84) 99632-7329"). Se não
 * der pra parsear, devolve o original.
 */
function formatPhone(raw: string | null | undefined): string {
  if (!raw) return "";
  const digits = raw.split("@")[0]?.split(":")[0] ?? "";
  if (!digits) return raw;
  const cc = digits.slice(0, 2);
  const rest = digits.slice(2);
  if (rest.length === 11) {
    return `+${cc} (${rest.slice(0, 2)}) ${rest.slice(2, 7)}-${rest.slice(7)}`;
  }
  if (rest.length === 10) {
    return `+${cc} (${rest.slice(0, 2)}) ${rest.slice(2, 6)}-${rest.slice(6)}`;
  }
  return `+${digits}`;
}

export function WhatsappConnectCard({ initial }: { initial: Initial }) {
  const [, startTransition] = useTransition();
  const [snapshot, setSnapshot] = useState<Snapshot>({
    state: (initial.evolution_state ?? "close") as EvolutionState,
    qrcode: undefined,
    ownerJid: initial.evolution_owner_jid,
    webhookPending: false,
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [provisioned, setProvisioned] = useState(
    Boolean(initial.evolution_instance_name && initial.evolution_webhook_set),
  );

  // Polling de QR: enquanto não estiver `open`, busca a cada 8s. QR
  // expira em ~60s mas a Evolution manda `qrcode.updated` via webhook —
  // o client só precisa de um fallback caso o webhook demore.
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const stopPolling = useCallback(() => {
    if (pollTimer.current) {
      clearInterval(pollTimer.current);
      pollTimer.current = null;
    }
  }, []);
  const startPolling = useCallback(() => {
    stopPolling();
    pollTimer.current = setInterval(async () => {
      const result = await refreshEvolutionQr();
      if (!result.ok) {
        // Erro durante polling — para de bater e mostra msg.
        stopPolling();
        setError(result.error);
        return;
      }
      setSnapshot((prev) => ({
        ...prev,
        qrcode: result.data.qrcode ?? prev.qrcode,
        state: (result.data.state ?? prev.state) as EvolutionState,
      }));
      if (result.data.state === "open") {
        stopPolling();
      }
    }, 8000);
  }, [stopPolling]);

  useEffect(() => {
    if (provisioned && snapshot.state !== "open") {
      startPolling();
    }
    return () => stopPolling();
  }, [provisioned, snapshot.state, startPolling, stopPolling]);

  function handleProvision() {
    setError(null);
    setBusy(true);
    startTransition(async () => {
      const result = await provisionEvolution();
      setBusy(false);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setProvisioned(true);
      setSnapshot({
        state: (result.data.state ?? "close") as EvolutionState,
        qrcode: result.data.qrcode,
        ownerJid: null,
        webhookPending: Boolean((result.data as { webhook_pending?: boolean }).webhook_pending),
      });
      if (result.data.state !== "open") startPolling();
    });
  }

  function handleDisconnect() {
    if (
      !confirm(
        "Desconectar este WhatsApp? O pareamento atual sera desfeito e um QR Code novo sera gerado automaticamente para escanear.",
      )
    ) {
      return;
    }
    setError(null);
    setBusy(true);
    startTransition(async () => {
      const result = await disconnectEvolution();
      setBusy(false);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      // disconnectEvolution ja entrega QR novo (logout+delete+create+connect).
      setProvisioned(true);
      setSnapshot({
        state: "close",
        qrcode: result.data?.qrcode ?? undefined,
        ownerJid: null,
      });
      // Polling continua para atualizar o QR caso expire antes do scan.
      startPolling();
    });
  }

  function handleRefresh() {
    setError(null);
    setBusy(true);
    startTransition(async () => {
      const result = await refreshEvolutionQr();
      setBusy(false);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSnapshot({
        state: (result.data.state ?? "close") as EvolutionState,
        qrcode: result.data.qrcode,
        ownerJid: null,
      });
    });
  }

  /** Recria do zero: logout + delete + create + connect. Usado quando a
   *  Evolution reporta "Connected" sem numero pareado (instancia zumbi) —
   *  sai da UI sem conseguir enviar msg. O `provisionEvolution` ja tenta
   *  auto-recriar ao detectar, mas esse botao da ao usuario o controle
   *  manual quando ele suspeita do estado. */
  function handleRecreate() {
    if (
      !confirm(
        "Recriar a instancia do WhatsApp do zero? A sessao atual sera desfeita e um QR Code novo sera gerado.",
      )
    ) {
      return;
    }
    setError(null);
    setBusy(true);
    startTransition(async () => {
      const result = await recreateEvolution();
      setBusy(false);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setProvisioned(true);
      setSnapshot({
        state: (result.data.state ?? "close") as EvolutionState,
        qrcode: result.data.qrcode,
        ownerJid: null,
      });
      if (result.data.state !== "open") startPolling();
    });
  }

  const isConnected = snapshot.state === "open";
  const isConnecting = snapshot.state === "connecting";
  const isZombie = isConnected && !snapshot.ownerJid;
  const showQr = provisioned && !isConnected && Boolean(snapshot.qrcode);

  return (
    <div className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-50 text-green-700">
            <MessageCircle className="h-5 w-5" aria-hidden />
          </div>
          <div>
            <h2 className="font-semibold text-stone-900">Conexão WhatsApp</h2>
            <p className="text-xs text-stone-500">
              {initial.evolution_instance_name
                ? `Instância: ${initial.evolution_instance_name}`
                : "Nenhuma instância provisionada"}
            </p>
          </div>
        </div>
        <ConnectionBadge state={snapshot.state} zombie={isZombie} />
      </div>

      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        {/* Banner de instancia zumbi: Evolution diz "Connected" mas sem
            ownerJid. Sem sessao real — envio de mensagens falha em silencio.
            Instrucao: clicar em "Recriar do zero" pra forcar nova sessao. */}
        {isZombie ? (
          <div className="sm:col-span-2 flex items-start gap-2 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <div>
              <p className="font-medium">Instancia em estado zumbi</p>
              <p>
                A Evolution reporta que esta conectada, mas nao ha numero
                de telefone pareado. Mensagens nao serao entregues. Clique
                em <strong>Recriar do zero</strong> abaixo pra forcar uma
                nova sessao.
              </p>
            </div>
          </div>
        ) : null}
        {/* Banner de webhook pendente — aparece quando a Evolution aceitou
            provisionar a instancia mas o setWebhook deu ruim. Loja continua
            funcional (cliente escaneia QR, manda msg, etc) mas eventos nao
            vao chegar no n8n ate reconfigurar. */}
        {snapshot.webhookPending && !isConnected ? (
          <div className="sm:col-span-2 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <div>
              <p className="font-medium">Webhook ficou pendente</p>
              <p>
                A Evolution aceitou a instancia mas nao conseguimos
                configurar o webhook agora. Voce ainda pode escanear o QR
                e operar a loja — mensagens nao serao repassadas pro n8n
                ate reconfigurar (clique Atualizar QR pra retentar).
              </p>
            </div>
          </div>
        ) : null}
        {/* Coluna do QR */}
        <div className="flex flex-col items-center justify-center">
          {showQr ? (
            <div className="space-y-3 text-center">
              <div className="mx-auto h-56 w-56 overflow-hidden rounded-lg border border-stone-200 bg-stone-50">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={normalizeQrSrc(snapshot.qrcode)}
                  alt="QR Code WhatsApp"
                  className="h-full w-full object-contain"
                />
              </div>
              <p className="text-sm text-stone-600">
                Abra o WhatsApp → Configurações → Aparelhos conectados →
                Conectar aparelho → escaneie este QR.
              </p>
            </div>
          ) : isConnected ? (
            <div className="flex h-56 w-full flex-col items-center justify-center rounded-lg border border-green-200 bg-green-50 p-4 text-center">
              <Smartphone className="h-12 w-12 text-green-700" aria-hidden />
              <p className="mt-2 font-semibold text-green-900">WhatsApp conectado</p>
              {snapshot.ownerJid ? (
                <p className="mt-1 font-mono text-sm text-green-800">
                  {formatPhone(snapshot.ownerJid)}
                </p>
              ) : null}
            </div>
          ) : (
            <div className="flex h-56 w-full flex-col items-center justify-center rounded-lg border border-dashed border-stone-300 bg-stone-50 p-4 text-center text-sm text-stone-500">
              {provisioned ? (
                <>
                  <Loader2 className="h-6 w-6 animate-spin text-stone-400" aria-hidden />
                  <p className="mt-2">Aguardando pareamento...</p>
                </>
              ) : (
                <>
                  <WifiOff className="h-6 w-6 text-stone-400" aria-hidden />
                  <p className="mt-2">Clique em &quot;Conectar WhatsApp&quot; para começar.</p>
                </>
              )}
            </div>
          )}
        </div>

        {/* Coluna de ações */}
        <div className="flex flex-col justify-center space-y-3">
          {!provisioned ? (
            <Button
              type="button"
              onClick={handleProvision}
              disabled={busy}
              className="w-full"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Wifi className="h-4 w-4" aria-hidden />
              )}
              Conectar WhatsApp
            </Button>
          ) : isConnected ? (
            <Button
              type="button"
              variant="outline"
              onClick={handleDisconnect}
              disabled={busy}
              className="w-full"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Power className="h-4 w-4" aria-hidden />
              )}
              Desconectar
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              onClick={handleRefresh}
              disabled={busy}
              className="w-full"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <RefreshCw className="h-4 w-4" aria-hidden />
              )}
              Atualizar QR
            </Button>
          )}

          {provisioned && !isConnected && (
            <p className="text-xs text-stone-500">
              {isConnecting
                ? "Estabelecendo conexão..."
                : "O QR atualiza automaticamente a cada 8s."}
            </p>
          )}

          {provisioned && (isConnected || isZombie) && (
            <Button
              type="button"
              variant="outline"
              onClick={handleRecreate}
              disabled={busy}
              className="w-full"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <RefreshCw className="h-4 w-4" aria-hidden />
              )}
              Recriar do zero
            </Button>
          )}

          {error && (
            <p role="alert" className="text-sm text-red-600">
              {error}
            </p>
          )}
        </div>
      </div>

      <div className="mt-6 border-t border-stone-100 pt-4">
        <details className="text-xs text-stone-500">
          <summary className="cursor-pointer select-none font-medium text-stone-700">
            Sobre esta conexão
          </summary>
          <div className="mt-2 space-y-1">
            <p>
              Esta loja usa uma instância dedicada na Evolution API
              {initial.evolution_instance_name
                ? ` (${initial.evolution_instance_name})`
                : ""}
              .
            </p>
            <p>
              Quando o cliente fizer um pedido, a mensagem é entregue direto
              no WhatsApp conectado, sem precisar abrir link manual.
            </p>
          </div>
        </details>
      </div>
    </div>
  );
}

function ConnectionBadge({ state, zombie = false }: { state: EvolutionState; zombie?: boolean }) {
  if (state === "open" && zombie) {
    return <Badge tone="danger">Conectado (zumbi)</Badge>;
  }
  if (state === "open") {
    return <Badge tone="success">Conectado</Badge>;
  }
  if (state === "connecting") {
    return <Badge tone="warning">Conectando</Badge>;
  }
  return <Badge tone="neutral">Desconectado</Badge>;
}
