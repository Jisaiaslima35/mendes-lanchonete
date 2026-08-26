"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

const MAX_SIZE_MB = 5;

export function ImageUpload({
  folder,
  value,
  onChange,
}: {
  folder: "produtos" | "categorias" | "promocoes" | "marca";
  value: string;
  onChange: (url: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setError(null);

    if (!file.type.startsWith("image/")) {
      setError("Selecione um arquivo de imagem.");
      return;
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      setError(`A imagem deve ter no máximo ${MAX_SIZE_MB}MB.`);
      return;
    }

    setUploading(true);
    const supabase = createClient();
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `${folder}/${crypto.randomUUID()}.${ext}`;

    const { error: uploadError } = await supabase.storage.from("midia").upload(path, file, {
      cacheControl: "3600",
      upsert: false,
    });

    if (uploadError) {
      setUploading(false);
      setError("Não foi possível enviar a imagem. Tente novamente.");
      return;
    }

    const { data } = supabase.storage.from("midia").getPublicUrl(path);
    setUploading(false);
    onChange(data.publicUrl);
  }

  return (
    <div className="space-y-2">
      {value ? (
        <div className="relative h-32 w-32 overflow-hidden rounded-lg border border-stone-200 bg-stone-100">
          <Image src={value} alt="" fill sizes="128px" className="object-cover" />
        </div>
      ) : (
        <div className="flex h-32 w-32 items-center justify-center rounded-lg border border-dashed border-stone-300 text-center text-xs text-stone-400">
          Sem imagem
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = "";
        }}
      />

      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? "Enviando..." : value ? "Trocar imagem" : "Enviar imagem"}
        </Button>
        {value && (
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange("")}>
            Remover
          </Button>
        )}
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
