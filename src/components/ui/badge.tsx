import { cn } from "@/lib/utils";

type Tone = "neutral" | "success" | "warning" | "danger" | "brand" | "sale";

const TONE_CLASSES: Record<Tone, string> = {
  neutral: "bg-stone-100 text-stone-700",
  success: "bg-green-100 text-green-800",
  warning: "bg-amber-100 text-amber-800",
  danger: "bg-red-100 text-red-800",
  brand: "bg-brand-100 text-brand-800",
  sale: "bg-tomato-500 text-white",
};

export function Badge({
  tone = "neutral",
  className,
  children,
}: {
  tone?: Tone;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        TONE_CLASSES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
