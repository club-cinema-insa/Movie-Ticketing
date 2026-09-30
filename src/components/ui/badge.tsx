import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold leading-none [&_svg]:size-3.5 [&_svg]:shrink-0",
  {
    variants: {
      tone: {
        neutral: "bg-muted text-subtle",
        brand: "bg-brand-soft text-brand-strong",
        success: "bg-success-soft text-success",
        warning: "bg-warning-soft text-[#6b4d00]",
        danger: "bg-danger-soft text-danger",
        accent: "bg-accent-soft text-[#7a4300]",
        inverse: "bg-white/15 text-white backdrop-blur",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export function Badge({
  className,
  tone,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
