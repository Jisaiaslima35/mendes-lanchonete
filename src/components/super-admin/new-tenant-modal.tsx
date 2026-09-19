"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { X, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, Checkbox, FieldError, FieldGroup } from "@/components/ui/field";
import { createTenant } from "@/lib/actions/super-admin-tenants";

/**
 * Modal "Novo Estabelecimento" — Controlled Component. Backdrop
 * opaco, focus trap basico via autofocus no primeiro campo, ESC pra
 * fechar, clique no backdrop fecha.
 *
 * Submete via `createTenant` server action. Em sucesso, mostra toast
 * verde simples + fecha + `router.refresh()` pra revalidar a lista.
 * Em erro, mostra mensagem do server e field-level errors do Zod.
 */
export function NewTenantModal({
  rootDomain,
  onClose,
}: {
  rootDomain: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [copied, setCopied] = useState(false);
  const [success, setSuccess] = useState<{
    slug: string;
    subdomain: string | null;
    owner_email?: string | null;
    temp_password?: string | null;
    owner_created?: boolean;
  } | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !saving) onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, saving]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setFieldErrors({});

    const form = new FormData(e.currentTarget);
    const payload = {
      name: String(form.get("name") ?? ""),
      slug: String(form.get("slug") ?? ""),
      subdomain: String(form.get("subdomain") ?? ""),
      owner_phone: String(form.get("owner_phone") ?? ""),
      owner_email: String(form.get("owner_email") ?? ""),
      owner_password: String(form.get("owner_password") ?? ""),
      seed_tables: form.get("seed_tables") === "on",
      seed_categories: form.get("seed_categories") === "on",
    };

    const result = await createTenant(payload);
    setSaving(false);

    if (!result.ok) {
      setError(result.error);
      setFieldErrors(result.fieldErrors ?? {});
      return;
    }

    setSuccess({
      slug: result.data.slug,
      subdomain: result.data.subdomain,
      owner_email: result.data.owner_email,
      temp_password: result.data.temp_password,
      owner_created: result.data.owner_created,
    });

    // refresh do server-side: recarrega a tabela de tenants.
    router.refresh();

    // Se NÃO gerou senha/credencial, fecha após 1.5s.
    // Se gerou senha temporária, mantém aberto para o admin copiar.
    if (!result.data.temp_password) {
      setTimeout(() => {
        onClose();
      }, 1500);
    }
  }

  function handleCopyCredentials() {
    if (!success) return;
    const adminUrl = `https://${success.subdomain || `${success.slug}.${rootDomain}`}/admin/login`;
    const text = `🏪 *Acesso ao seu Painel de Delivery*\n🔗 Link: ${adminUrl}\n📧 Login: ${success.owner_email ?? ""}\n🔑 Senha: ${success.temp_password ?? ""}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="new-tenant-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !saving) onClose();
      }}
    >
      <div className="w-full max-w-lg rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-stone-200 px-5 py-3">
          <h2 id="new-tenant-title" className="text-base font-semibold text-stone-900">
            Novo Estabelecimento
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Fechar"
            className="rounded p-1 text-stone-500 hover:bg-stone-100 disabled:opacity-50"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        {success ? (
          <div className="flex flex-col items-center gap-3 px-5 py-8 text-center">
            <CheckCircle2 className="h-10 w-10 text-emerald-600" aria-hidden />
            <p className="text-base font-semibold text-stone-900">
              Estabelecimento criado com sucesso!
            </p>
            <p className="text-xs text-stone-500">
              slug: <code className="rounded bg-stone-100 px-1.5 py-0.5">{success.slug}</code>
              {success.subdomain ? (
                <>
                  {" · "}
                  <code className="rounded bg-stone-100 px-1.5 py-0.5">
                    {success.subdomain}
                  </code>
                </>
              ) : null}
            </p>

            {success.owner_created && success.temp_password ? (
              <div className="mt-3 w-full rounded-lg border border-amber-200 bg-amber-50 p-4 text-left">
                <p className="text-xs font-semibold uppercase tracking-wider text-amber-900">
                  Credenciais de Acesso do Dono
                </p>
                <div className="mt-2 space-y-1.5 text-xs text-stone-700">
                  <p>
                    <span className="font-semibold text-stone-900">E-mail:</span>{" "}
                    <code>{success.owner_email}</code>
                  </p>
                  <p>
                    <span className="font-semibold text-stone-900">Senha:</span>{" "}
                    <code className="font-bold text-stone-900">{success.temp_password}</code>
                  </p>
                </div>
                <div className="mt-4 flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    className="w-full text-xs"
                    onClick={handleCopyCredentials}
                  >
                    {copied ? "Copiado para WhatsApp!" : "Copiar Dados de Acesso"}
                  </Button>
                </div>
              </div>
            ) : null}

            <div className="mt-4 flex w-full justify-end border-t border-stone-200 pt-3">
              <Button type="button" variant="outline" onClick={onClose}>
                Concluir
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3 px-5 py-4">
            {error ? (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden />
                <span>{error}</span>
              </div>
            ) : null}

            <FieldGroup>
              <Label htmlFor="name" required>
                Nome do estabelecimento
              </Label>
              <Input
                id="name"
                name="name"
                placeholder="Hot Dog do Formiga"
                required
                autoFocus
              />
              <FieldError message={fieldErrors.name?.[0]} />
            </FieldGroup>

            <div className="grid grid-cols-2 gap-3">
              <FieldGroup>
                <Label htmlFor="slug" required>
                  Slug
                </Label>
                <Input
                  id="slug"
                  name="slug"
                  placeholder="formiga"
                  required
                  pattern="^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$"
                />
                <FieldError message={fieldErrors.slug?.[0]} />
              </FieldGroup>
              <FieldGroup>
                <Label htmlFor="subdomain">Subdomínio (opcional)</Label>
                <Input
                  id="subdomain"
                  name="subdomain"
                  placeholder={`formiga.${rootDomain}`}
                />
                <FieldError message={fieldErrors.subdomain?.[0]} />
              </FieldGroup>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <FieldGroup>
                <Label htmlFor="owner_phone">WhatsApp do dono</Label>
                <Input
                  id="owner_phone"
                  name="owner_phone"
                  placeholder="5584999999999"
                  inputMode="numeric"
                />
                <FieldError message={fieldErrors.owner_phone?.[0]} />
              </FieldGroup>
              <FieldGroup>
                <Label htmlFor="owner_email">E-mail do dono (Login)</Label>
                <Input
                  id="owner_email"
                  name="owner_email"
                  type="email"
                  placeholder="dono@exemplo.com"
                />
                <FieldError message={fieldErrors.owner_email?.[0]} />
              </FieldGroup>
            </div>

            <FieldGroup>
              <Label htmlFor="owner_password">Senha inicial (opcional)</Label>
              <Input
                id="owner_password"
                name="owner_password"
                type="text"
                placeholder="Deixe em branco para auto-gerar"
              />
              <FieldError message={fieldErrors.owner_password?.[0]} />
            </FieldGroup>

            <div className="rounded-lg border border-stone-200 bg-stone-50 p-3">
              <p className="text-xs font-medium text-stone-700">Seed na criação</p>
              <div className="mt-2 space-y-1.5">
                <label className="flex items-center gap-2 text-sm text-stone-700">
                  <Checkbox name="seed_tables" defaultChecked />
                  Criar 5 mesas ativas (1 a 5)
                </label>
                <label className="flex items-center gap-2 text-sm text-stone-700">
                  <Checkbox name="seed_categories" defaultChecked />
                  Criar cardápio modelo (Lanches, Bebidas e Adicionais)
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-stone-200 pt-4">
              <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Criando..." : "Criar Estabelecimento"}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
