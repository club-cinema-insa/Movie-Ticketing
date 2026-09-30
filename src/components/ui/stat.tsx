import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const tones = {
  brand: "bg-brand-soft text-brand-strong",
  success: "bg-success-soft text-success",
  accent: "bg-accent-soft text-[#7a4300]",
  neutral: "bg-muted text-subtle",
} as const;

/** Indicateur chiffré : icône, valeur et légende. */
export function Stat({
  icon: Icon,
  label,
  value,
  suffix,
  tone = "brand",
  className,
}: {
  icon: LucideIcon;
  label: string;
  value: React.ReactNode;
  suffix?: React.ReactNode;
  tone?: keyof typeof tones;
  className?: string;
}) {
  return (
    <div className={cn("rounded-2xl border border-line bg-surface p-3.5 shadow-card sm:p-4", className)}>
      <span className={cn("mb-2 inline-flex size-9 items-center justify-center rounded-xl", tones[tone])}>
        <Icon className="size-5" aria-hidden />
      </span>
      <p className="font-display text-2xl font-extrabold leading-none tabular sm:text-3xl">
        {value}
        {suffix && <span className="ml-1 text-base font-semibold text-subtle">{suffix}</span>}
      </p>
      <p className="mt-1.5 text-xs text-subtle sm:text-sm">{label}</p>
    </div>
  );
}
