import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn("size-5 animate-spin text-brand", className)} aria-label="Chargement" />;
}

/** Écran de chargement centré. */
export function PageSpinner({ label = "Chargement" }: { label?: string }) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-subtle">
      <Spinner className="size-8" />
      <p className="text-sm">{label}…</p>
    </div>
  );
}
