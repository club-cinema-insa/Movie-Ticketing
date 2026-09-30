import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Button } from "@/components/ui/button";

/**
 * Confirmation d'une action sensible : feuille ancrée en bas sur téléphone,
 * fenêtre centrée sur grand écran.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel = "Annuler",
  tone = "danger",
  loading = false,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: React.ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: "danger" | "primary";
  loading?: boolean;
  onConfirm: () => void | Promise<void>;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[60] bg-ink/55 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed inset-x-0 bottom-0 z-[61] rounded-t-3xl bg-surface p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] shadow-pop focus:outline-none data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom-8 sm:inset-auto sm:left-1/2 sm:top-1/2 sm:w-full sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl sm:data-[state=open]:slide-in-from-bottom-0 sm:data-[state=open]:zoom-in-95">
          <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-line-strong sm:hidden" aria-hidden />
          <Dialog.Title className="font-display text-xl font-bold">{title}</Dialog.Title>
          {description && (
            <Dialog.Description className="mt-2 text-[0.95rem] text-subtle">{description}</Dialog.Description>
          )}
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Dialog.Close asChild>
              <Button variant="secondary" disabled={loading}>
                {cancelLabel}
              </Button>
            </Dialog.Close>
            <Button variant={tone === "danger" ? "danger" : "primary"} loading={loading} onClick={() => void onConfirm()}>
              {confirmLabel}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
