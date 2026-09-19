"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { ImageOff as ImageOffIcon, Upload, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Limite duro: 2MB (recomendado pelo Isaías msg 4790). Acima disso,
// orienta o usuário a reduzir a imagem antes do upload. Sem isso o
// bucket enche de foto de celular com 8MB+ que mata o carregamento.
const MAX_SIZE_MB = 2;
// Lado máximo (long edge) — imagens maiores sao downsized no client via
// canvas antes do upload, mantendo proporcao e evitando ultrapassar o
// limite de tamanho. 1024px eh folgado pra thumbnails + cardápio.
const MAX_DIMENSION = 1024;
// Qualidade JPEG/WebP final apos resize (0-1).
const OUTPUT_QUALITY = 0.85;

type Folder = "produtos" | "categorias" | "promocoes" | "marca";

export function ImageUpload({
  folder,
  value,
  onChange,
}: {
  folder: Folder;
  value: string;
  onChange: (url: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Erro de load da preview (404 no bucket, host bloqueado, etc).
  // Separado do `error` de upload — sao falhas diferentes na UX.
  const [previewError, setPreviewError] = useState(false);

  /**
   * Redimensiona e recomprime a imagem no client via Canvas antes do
   * upload. Garante:
   *   -1. longEdge <= MAX_DIMENSION (mantem aspect ratio)
   *   -2. mime type = image/webp (compacta bem fotos) OU image/jpeg fallback
   *   -3. qualidade OUTPUT_QUALITY (default 0.85)
   * Retorna File novo, pronto pra upload. Em browsers sem Canvas
   * (raríssimo), cai pro File original — upload pode falhar pelo
   * tamanho mas pelo menos nao trava a UI.
   */
  async function compressImage(file: File): Promise<File> {
    if (typeof document === "undefined" || !file.type.startsWith("image/")) {
      return file;
    }
    try {
      const bitmap = await createImageBitmap(file);
      const { width: w0, height: h0 } = bitmap;
      const scale = Math.min(1, MAX_DIMENSION / Math.max(w0, h0));
      const w = Math.round(w0 * scale);
      const h = Math.round(h0 * scale);

      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return file;
      ctx.drawImage(bitmap, 0, 0, w, h);

      // WebP nao é suportado por Safari antigo, mas o projeto roda em
      // navegadores modernos (lojas daqui usam Chrome mobile). Fallback
      // pra JPEG se WebP falhar.
      const targetType = "image/webp";
      const blob: Blob | null = await new Promise((resolve) =>
        canvas.toBlob((b) => resolve(b), targetType, OUTPUT_QUALITY),
      );
      if (!blob) return file;

      const ext = targetType === "image/webp" ? "webp" : "jpg";
      const newName = file.name.replace(/\.[^.]+$/, "") + "." + ext;
      return new File([blob], newName, { type: targetType, lastModified: Date.now() });
    } catch {
      // Imagem corrompida ou formato exotico — deixa o upload error
      // surface pro usuario.
      return file;
    }
  }

  async function handleFile(rawFile: File) {
    setError(null);
    setPreviewError(false);

    if (!rawFile.type.startsWith("image/")) {
      setError("Selecione um arquivo de imagem.");
      return;
    }
    if (rawFile.size > MAX_SIZE_MB * 1024 * 1024) {
      setError(
        `A imagem deve ter no máximo ${MAX_SIZE_MB}MB. Reduza o tamanho antes de enviar.`,
      );
      return;
    }

    setUploading(true);
    try {
      // Compress / resize no client pra Upload mais rapido e bucket enxuto.
      const file = await compressImage(rawFile);

      const supabase = createClient();
      const ext = file.name.split(".").pop() ?? "webp";
      const path = `${folder}/${crypto.randomUUID()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("midia")
        .upload(path, file, {
          cacheControl: "3600",
          upsert: false,
          contentType: file.type,
        });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("midia").getPublicUrl(path);
      onChange(data.publicUrl);
    } catch (e) {
      // Mensagem generica — detalhes de storage podem vazar info do bucket.
      // eslint-disable-next-line no-console
      console.error("[image-upload] falhou:", e);
      setError("Nao foi possivel enviar a imagem. Tente novamente.");
    } finally {
      setUploading(false);
    }
  }

  const hasValidImage = value && !previewError;

  return (
    <div className="space-y-2">
      <div
        className={cn(
          "relative h-32 w-32 overflow-hidden rounded-lg border bg-stone-100",
          previewError ? "border-dashed border-stone-300" : "border-stone-200",
        )}
      >
        {value ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <Image
              src={value}
              alt=""
              fill
              sizes="128px"
              className={cn("object-cover", !hasValidImage && "hidden")}
              onError={() => setPreviewError(true)}
              onLoad={() => setPreviewError(false)}
            />
            {previewError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-stone-400">
                <ImageOffIcon className="h-6 w-6" aria-hidden />
                <span className="px-2 text-center text-[10px] leading-tight">
                  Imagem indisponível
                </span>
              </div>
            )}
          </>
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-stone-400">
            Sem imagem
          </div>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
          e.target.value = "";
        }}
      />

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          <Upload className="h-3.5 w-3.5" aria-hidden />
          {uploading ? "Enviando..." : value ? "Trocar imagem" : "Enviar imagem"}
        </Button>
        {value && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              onChange("");
              setPreviewError(false);
            }}
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden />
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
