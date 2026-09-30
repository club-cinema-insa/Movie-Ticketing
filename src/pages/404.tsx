import Link from "next/link";
import { Clapperboard } from "lucide-react";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { Button } from "@/components/ui/button";

/** Claquette : le clin d'œil de la page introuvable. */
function Clapperboard404() {
  return (
    <div className="mx-auto w-full max-w-xs -rotate-2 overflow-hidden rounded-2xl bg-ink text-white shadow-pop" aria-hidden>
      <div
        className="h-8 border-b-4 border-accent"
        style={{
          backgroundImage:
            "repeating-linear-gradient(115deg, var(--ink) 0 18px, var(--canvas) 18px 36px)",
        }}
      />
      <dl className="grid grid-cols-3 gap-x-3 gap-y-3 px-5 py-4 text-left">
        <div>
          <dt className="text-[0.65rem] font-semibold uppercase tracking-wider text-white/55">Scène</dt>
          <dd className="font-display text-2xl font-extrabold text-accent">404</dd>
        </div>
        <div>
          <dt className="text-[0.65rem] font-semibold uppercase tracking-wider text-white/55">Prise</dt>
          <dd className="font-display text-2xl font-extrabold">1</dd>
        </div>
        <div>
          <dt className="text-[0.65rem] font-semibold uppercase tracking-wider text-white/55">Durée</dt>
          <dd className="font-display text-2xl font-extrabold">0 s</dd>
        </div>
        <div className="col-span-3 border-t border-white/15 pt-3">
          <dt className="text-[0.65rem] font-semibold uppercase tracking-wider text-white/55">Film</dt>
          <dd className="font-display text-lg font-bold">La page qui n’existait pas</dd>
        </div>
      </dl>
    </div>
  );
}

export default function NotFoundPage() {
  return (
    <PublicLayout title="Page introuvable" noindex>
      <div className="mx-auto max-w-lg px-4 pb-4 pt-12 text-center sm:pt-20">
        <Clapperboard404 />

        <p className="mt-10 text-sm font-semibold uppercase tracking-widest text-brand">Erreur 404</p>
        <h1 className="mt-2 text-3xl font-extrabold sm:text-4xl">Coupez ! Cette page a quitté le plateau.</h1>
        <p className="mx-auto mt-3 max-w-md text-[0.95rem] text-subtle">
          Elle a été déplacée, supprimée, ou n’a tout simplement jamais été tournée. Bonne nouvelle : les vraies séances, elles, sont
          bien au programme.
        </p>

        <Button asChild variant="cta" size="lg" className="mt-8">
          <Link href="/events">
            <Clapperboard aria-hidden />
            Voir les séances
          </Link>
        </Button>
      </div>
    </PublicLayout>
  );
}
