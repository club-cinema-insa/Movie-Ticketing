import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center rounded-2xl border border-dashed border-line-strong bg-surface/60 px-6 py-12 text-center", className)}>
      <span className="mb-4 inline-flex size-14 items-center justify-center rounded-2xl bg-brand-soft text-brand">
        <Icon className="size-7" aria-hidden />
      </span>
      <p className="font-display text-lg font-bold">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-subtle">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
