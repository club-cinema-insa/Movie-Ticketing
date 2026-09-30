import * as React from "react";
import { cn } from "@/lib/utils";

const controlClasses =
  "w-full rounded-xl border border-line-strong bg-surface px-4 text-ink shadow-sm transition placeholder:text-subtle/70 focus:border-brand focus:outline-none focus:ring-4 focus:ring-highlight/30 disabled:cursor-not-allowed disabled:opacity-60 aria-[invalid=true]:border-danger aria-[invalid=true]:ring-danger/15";

export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return <input className={cn(controlClasses, "h-12", className)} {...props} />;
}

export function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return <textarea className={cn(controlClasses, "min-h-28 py-3", className)} {...props} />;
}

export function Select({ className, ...props }: React.ComponentProps<"select">) {
  return (
    <select
      className={cn(controlClasses, "h-12 appearance-none bg-[length:1.1rem] bg-[right_0.9rem_center] bg-no-repeat pr-11", className)}
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2350696a' stroke-width='2.4' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
      }}
      {...props}
    />
  );
}

type FieldProps = {
  label: string;
  htmlFor: string;
  hint?: React.ReactNode;
  error?: string | null;
  optional?: boolean;
  className?: string;
  children: React.ReactNode;
};

/** Libellé + champ + aide/erreur, avec des espacements identiques partout. */
export function Field({ label, htmlFor, hint, error, optional, className, children }: FieldProps) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={htmlFor} className="flex items-baseline justify-between gap-2 text-sm font-semibold text-ink">
        <span>{label}</span>
        {optional && <span className="text-xs font-normal text-subtle">Facultatif</span>}
      </label>
      {children}
      {error ? (
        <p role="alert" className="text-sm font-medium text-danger">
          {error}
        </p>
      ) : hint ? (
        <p className="text-sm text-subtle">{hint}</p>
      ) : null}
    </div>
  );
}
