import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "inline-flex shrink-0 select-none items-center justify-center gap-2 whitespace-nowrap rounded-xl font-semibold transition duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-[1.15em]",
  {
    variants: {
      variant: {
        primary: "bg-brand text-white shadow-sm hover:bg-brand-strong",
        cta: "bg-accent text-ink shadow-sm hover:bg-accent-strong",
        secondary: "border border-line-strong bg-surface text-ink hover:bg-muted",
        soft: "bg-brand-soft text-brand-strong hover:bg-highlight-soft",
        ghost: "text-ink hover:bg-muted",
        danger: "bg-danger text-white shadow-sm hover:bg-[color-mix(in_oklab,var(--color-danger)_86%,black)]",
        "danger-soft":
          "bg-danger-soft text-danger hover:bg-[color-mix(in_oklab,var(--color-danger)_16%,white)]",
      },
      size: {
        sm: "h-9 px-3.5 text-sm",
        md: "h-11 px-5 text-[0.95rem]",
        lg: "h-14 px-7 text-base",
        icon: "size-11",
        "icon-sm": "size-9",
      },
      block: { true: "w-full", false: "" },
    },
    defaultVariants: { variant: "primary", size: "md", block: false },
  },
);

export type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
    loading?: boolean;
  };

export function Button({
  className,
  variant,
  size,
  block,
  asChild = false,
  loading = false,
  disabled,
  children,
  ...props
}: ButtonProps) {
  const classes = cn(buttonVariants({ variant, size, block }), className);

  if (asChild) {
    return (
      <Slot className={classes} {...props}>
        {children}
      </Slot>
    );
  }

  return (
    <button className={classes} disabled={disabled === true || loading} {...props}>
      {loading && <Loader2 className="animate-spin" aria-hidden />}
      {children}
    </button>
  );
}
