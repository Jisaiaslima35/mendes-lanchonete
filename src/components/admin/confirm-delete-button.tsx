"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import type { ActionResult } from "@/lib/errors";

export function ConfirmDeleteButton({
  action,
  confirmMessage = "Tem certeza que deseja excluir? Esta ação não pode ser desfeita.",
  label = "Excluir",
}: {
  action: () => Promise<ActionResult>;
  confirmMessage?: string;
  label?: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    if (!window.confirm(confirmMessage)) return;
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) setError(result.error);
    });
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        aria-label={label}
        title={label}
        className="inline-flex items-center rounded p-1.5 text-stone-400 hover:bg-red-50 hover:text-red-600 disabled:pointer-events-none disabled:opacity-50"
      >
        <Trash2 className="h-4 w-4" />
      </button>
      {error && (
        <span role="alert" className="text-xs text-red-600">
          {error}
        </span>
      )}
    </span>
  );
}
