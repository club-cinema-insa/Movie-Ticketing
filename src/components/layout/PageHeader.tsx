import Link from "next/link";
import { ArrowLeft } from "lucide-react";

/** Titre de page : retour facultatif, titre, description et actions. */
export function PageHeader({
  title,
  description,
  back,
  actions,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  back?: { href: string; label: string };
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 space-y-3 sm:mb-8">
      {back && (
        <Link
          href={back.href}
          className="inline-flex items-center gap-1.5 rounded-lg text-sm font-medium text-subtle hover:text-ink"
        >
          <ArrowLeft className="size-4" aria-hidden />
          {back.label}
        </Link>
      )}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-[1.75rem] font-extrabold sm:text-4xl">{title}</h1>
          {description && <p className="mt-1.5 text-[0.95rem] text-subtle sm:text-base">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    </div>
  );
}
