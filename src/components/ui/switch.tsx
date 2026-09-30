import { cn } from "@/lib/utils";

/** Interrupteur accessible (role="switch"), avec libellé et aide. */
export function Switch({
  checked,
  onCheckedChange,
  label,
  hint,
  id,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: string;
  hint?: string;
  id: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={`${id}-label`}
        onClick={() => onCheckedChange(!checked)}
        className={cn(
          "relative mt-0.5 inline-flex h-7 w-12 shrink-0 items-center rounded-full transition",
          checked ? "bg-brand" : "bg-line-strong",
        )}
      >
        <span
          className={cn(
            "inline-block size-5 rounded-full bg-white shadow transition-transform",
            checked ? "translate-x-6" : "translate-x-1",
          )}
        />
      </button>
      <div>
        <p id={`${id}-label`} className="text-sm font-semibold">
          {label}
        </p>
        {hint && <p className="text-sm text-subtle">{hint}</p>}
      </div>
    </div>
  );
}
