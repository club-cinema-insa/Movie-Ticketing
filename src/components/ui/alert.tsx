import * as React from "react";
import { CircleAlert, CircleCheck, Info, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

const tones = {
  info: { box: "border-brand/20 bg-brand-tint text-ink", icon: Info, iconClass: "text-brand" },
  success: { box: "border-success/25 bg-success-soft text-ink", icon: CircleCheck, iconClass: "text-success" },
  warning: { box: "border-warning/60 bg-warning-soft text-ink", icon: TriangleAlert, iconClass: "text-[#8a6100]" },
  danger: { box: "border-danger/25 bg-danger-soft text-ink", icon: CircleAlert, iconClass: "text-danger" },
} as const;

export type AlertTone = keyof typeof tones;

export function Alert({
  tone = "info",
  title,
  children,
  className,
}: {
  tone?: AlertTone;
  title?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  const { box, icon: Icon, iconClass } = tones[tone];
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={cn("flex gap-3 rounded-xl border p-3.5 text-sm", box, className)}>
      <Icon className={cn("mt-0.5 size-5 shrink-0", iconClass)} aria-hidden />
      <div className="min-w-0 space-y-0.5">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className="text-ink/85">{children}</div>}
      </div>
    </div>
  );
}
