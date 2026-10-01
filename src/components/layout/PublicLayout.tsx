import Link from "next/link";
import { Lock } from "lucide-react";
import { branding } from "@/config/branding";
import { SiteHead } from "@/components/layout/SiteHead";

/** Logo et nom du club, utilisés dans tous les en-têtes. */
export function BrandMark({ className = "" }: { className?: string }) {
  return (
    <span className={`flex items-center gap-3 ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={branding.logoUrl}
        alt=""
        width={40}
        height={40}
        className="size-10 rounded-xl object-cover ring-1 ring-ink/10"
      />
      <span className="font-display text-lg font-extrabold tracking-tight">{branding.appShortName}</span>
    </span>
  );
}

type PublicLayoutProps = {
  children: React.ReactNode;
  title?: string;
  description?: string;
  image?: string | null;
  noindex?: boolean;
};

/** Gabarit du site public : en-tête collant, contenu, pied de page. */
export function PublicLayout({ children, title, description, image, noindex }: PublicLayoutProps) {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHead title={title} description={description} image={image} noindex={noindex} />

      <header className="sticky top-0 z-30 border-b border-line/70 bg-canvas/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
          <Link href="/events" aria-label={`${branding.appName} — accueil`} className="rounded-xl">
            <BrandMark />
          </Link>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="mt-16 bg-brand-strong text-white/75">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-6 text-sm sm:px-6">
          <p>
            © {new Date().getFullYear()} {branding.appName}
          </p>
          <nav aria-label="Liens du site" className="flex items-center gap-5 font-medium">
            <Link href="/confidentialite" className="rounded-lg hover:text-white">
              Confidentialité
            </Link>
            <Link href="/admin/events" className="inline-flex items-center gap-1.5 rounded-lg hover:text-white">
              <Lock className="size-3.5" aria-hidden />
              Espace bureau
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
