import Link from "next/link";
import { useRouter } from "next/router";
import { SessionProvider, signIn, signOut, useSession } from "next-auth/react";
import { Clapperboard, Globe, LogOut, ScanLine, ShieldCheck, type LucideIcon } from "lucide-react";
import { branding } from "@/config/branding";
import { SiteHead } from "@/components/layout/SiteHead";
import { BrandMark } from "@/components/layout/PublicLayout";
import { DiscordIcon } from "@/components/icons/DiscordIcon";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageSpinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

type NavItem = { href: string; label: string; icon: LucideIcon; matches: (path: string) => boolean };

const NAV: NavItem[] = [
  { href: "/admin/events", label: "Séances", icon: Clapperboard, matches: (p) => p.startsWith("/admin/events") },
  { href: "/verify", label: "Contrôle", icon: ScanLine, matches: (p) => p.startsWith("/verify") },
  { href: "/admin/users", label: "Accès", icon: ShieldCheck, matches: (p) => p.startsWith("/admin/users") },
  { href: "/events", label: "Site", icon: Globe, matches: () => false },
];

function initials(name?: string | null) {
  return (name ?? "?")
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function SignInCard() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-12">
      <Card className="p-7 text-center sm:p-9">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={branding.logoUrl} alt="" width={72} height={72} className="mx-auto mb-5 size-[4.5rem] rounded-2xl ring-1 ring-ink/10" />
        <h1 className="text-2xl font-extrabold">Espace bureau</h1>
        <p className="mt-2 text-[0.95rem] text-subtle">
          Connectez-vous avec votre compte Discord pour gérer les séances et contrôler les billets.
        </p>
        <Button size="lg" block className="mt-6" onClick={() => void signIn("discord")}>
          <DiscordIcon className="size-5" />
          Se connecter avec Discord
        </Button>
        <p className="mt-4 text-xs text-subtle">Seuls les comptes autorisés par le bureau peuvent accéder à cet espace.</p>
      </Card>
    </div>
  );
}

type AdminLayoutProps = {
  children: React.ReactNode;
  title: string;
  /** Largeur du contenu (le scanner est plus étroit). */
  width?: "normal" | "narrow";
};

/**
 * Gabarit de l'espace bureau : connexion, barre du haut, navigation (en bas sur téléphone).
 * La session n'est chargée qu'ici : les pages publiques n'en ont pas besoin.
 */
export function AdminLayout(props: AdminLayoutProps) {
  return (
    <SessionProvider>
      <AdminShell {...props} />
    </SessionProvider>
  );
}

function AdminShell({ children, title, width = "normal" }: AdminLayoutProps) {
  const { data: session, status } = useSession();
  const { pathname } = useRouter();

  if (status === "loading") {
    return (
      <>
        <SiteHead title={title} noindex />
        <PageSpinner />
      </>
    );
  }

  if (!session) {
    return (
      <>
        <SiteHead title="Connexion" noindex />
        <SignInCard />
      </>
    );
  }

  const userName = session.user.name ?? session.user.email ?? "Membre du bureau";

  return (
    <div className="min-h-dvh">
      <SiteHead title={title} noindex />

      <header className="sticky top-0 z-40 bg-brand-strong text-white">
        <div className="mx-auto flex h-16 max-w-5xl items-center gap-4 px-4 sm:px-6">
          <Link href="/admin/events" aria-label="Espace bureau" className="rounded-xl">
            <BrandMark className="[&>span:last-child]:hidden sm:[&>span:last-child]:inline" />
          </Link>
          <span className="hidden rounded-full bg-white/12 px-2.5 py-1 text-xs font-semibold tracking-wide text-white/90 sm:inline">
            Bureau
          </span>

          <nav aria-label="Navigation principale" className="ml-4 hidden items-center gap-1 md:flex">
            {NAV.map(({ href, label, icon: Icon, matches }) => (
              <Link
                key={href}
                href={href}
                aria-current={matches(pathname) ? "page" : undefined}
                className={cn(
                  "inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold transition",
                  matches(pathname) ? "bg-white/15 text-white" : "text-white/70 hover:bg-white/10 hover:text-white",
                )}
              >
                <Icon className="size-4" aria-hidden />
                {label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <span className="hidden max-w-[12rem] truncate text-sm text-white/80 sm:inline">{userName}</span>
            {session.user.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={session.user.image} alt="" className="size-9 rounded-full ring-2 ring-white/25" />
            ) : (
              <span className="inline-flex size-9 items-center justify-center rounded-full bg-white/15 text-xs font-bold">
                {initials(userName)}
              </span>
            )}
            <button
              type="button"
              onClick={() => void signOut({ callbackUrl: "/events" })}
              aria-label="Se déconnecter"
              title="Se déconnecter"
              className="inline-flex size-10 items-center justify-center rounded-xl text-white/75 transition hover:bg-white/10 hover:text-white"
            >
              <LogOut className="size-5" aria-hidden />
            </button>
          </div>
        </div>
      </header>

      <main className={cn("mx-auto px-4 pb-nav pt-6 sm:px-6 sm:pt-8 md:pb-16", width === "narrow" ? "max-w-md" : "max-w-5xl")}>
        {children}
      </main>

      <nav
        aria-label="Navigation principale"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        <ul className="grid grid-cols-4">
          {NAV.map(({ href, label, icon: Icon, matches }) => {
            const active = matches(pathname);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative flex flex-col items-center gap-1 px-2 pb-2 pt-3 text-[0.7rem] font-semibold transition",
                    active ? "text-brand" : "text-subtle active:text-ink",
                  )}
                >
                  {active && <span className="absolute inset-x-6 top-0 h-[3px] rounded-b-full bg-brand" aria-hidden />}
                  <Icon className="size-6" strokeWidth={active ? 2.4 : 2} aria-hidden />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
