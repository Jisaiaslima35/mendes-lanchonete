"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NewTenantModal } from "./new-tenant-modal";

/**
 * Botao "Novo Estabelecimento" + estado do modal.
 * Separado do modal em si pra permitir reuso do botao em outros lugares.
 */
export function NewTenantButton({ rootDomain }: { rootDomain: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button type="button" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" aria-hidden />
        Novo Estabelecimento
      </Button>
      {open ? <NewTenantModal rootDomain={rootDomain} onClose={() => setOpen(false)} /> : null}
    </>
  );
}
