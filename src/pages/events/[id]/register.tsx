import { useRef, useState } from "react";
import Link from "next/link";
import type { GetServerSideProps } from "next";
import {
  ArrowLeft,
  CalendarDays,
  CalendarPlus,
  Clapperboard,
  Clock,
  DoorOpen,
  Hourglass,
  Download,
  Info,
  MapPin,
  Smartphone,
  Ticket,
  type LucideIcon,
} from "lucide-react";
import { db } from "@/server/db";
import { branding } from "@/config/branding";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { TicketStub } from "@/components/ticket/TicketStub";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Input } from "@/components/ui/field";
import { buildIcs, downloadTextFile } from "@/lib/ics";
import { eventSchedule, formatDayWithYear, remainingSeats, runtimeInfo } from "@/lib/format";

type EventPageProps = {
  /** Adresse du site, pour rendre absolue l'affiche hébergée ici dans les aperçus de lien. */
  origin: string;
  event: {
    id: string;
    name: string;
    date: string;
    location: string | null;
    description: string | null;
    image: string | null;
    maxTickets: number | null;
    startOffsetMinutes: number | null;
    director: string | null;
    runtimeMinutes: number | null;
    issued: number;
  } | null;
};

type RegisterResponse = {
  success: boolean;
  reused: boolean;
  emailSent: boolean;
  pdfUrl: string;
  manageUrl: string;
  ticket: {
    code: string;
    number: number | null;
    qrCode: string;
    eventName: string;
    participantName: string;
    participantEmail: string;
  };
};

export const getServerSideProps: GetServerSideProps<EventPageProps> = async (ctx) => {
  const id = ctx.params?.id as string | undefined;
  if (!id) return { notFound: true };

  const event = await db.event.findUnique({
    where: { id },
    include: { _count: { select: { tickets: true } } },
  });

  // Une projection non publiée n'existe pas pour le public.
  if (!event || !event.show) return { notFound: true };

  const host = ctx.req.headers["x-forwarded-host"] ?? ctx.req.headers.host ?? "";
  const proto = ctx.req.headers["x-forwarded-proto"] ?? "https";

  return {
    props: {
      origin: `${String(proto).split(",")[0]}://${String(host).split(",")[0]}`,
      event: {
        id: event.id,
        name: event.name,
        date: event.date.toISOString(),
        location: event.location,
        description: event.description,
        image: event.image,
        maxTickets: event.maxTickets,
        startOffsetMinutes: event.startOffsetMinutes,
        director: event.director,
        runtimeMinutes: event.runtimeMinutes,
        issued: event._count.tickets,
      },
    },
  };
};

function Fact({
  icon: Icon,
  label,
  children,
  wide = false,
}: {
  icon: LucideIcon;
  label: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <li className={`flex items-center gap-3.5 ${wide ? "sm:col-span-2" : ""}`}>
      <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand">
        <Icon className="size-5" aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-subtle">{label}</p>
        <div className="font-semibold leading-snug first-letter:uppercase">{children}</div>
      </div>
    </li>
  );
}

export default function RegisterPage({ event, origin }: EventPageProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<RegisterResponse | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  if (!event) {
    return (
      <PublicLayout title="Séance introuvable">
        <div className="mx-auto max-w-lg px-4 pt-16">
          <EmptyState
            icon={Clapperboard}
            title="Séance introuvable"
            description="Cette séance n’existe pas ou n’est plus disponible."
            action={
              <Button asChild>
                <Link href="/events">Voir les séances</Link>
              </Button>
            }
          />
        </div>
      </PublicLayout>
    );
  }

  const schedule = eventSchedule(event.date, event.startOffsetMinutes);
  const runtime = runtimeInfo(event.date, event.startOffsetMinutes, event.runtimeMinutes);
  const remaining = remainingSeats(event.maxTickets, event.issued);
  const full = remaining === 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/events/${event.id}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email }),
      });
      const data = (await res.json()) as RegisterResponse & { error?: string };

      if (!res.ok) {
        setError(data.error ?? "Une erreur est survenue. Veuillez réessayer.");
        return;
      }

      setResult(data);
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    } catch {
      setError("Connexion impossible. Vérifiez votre réseau puis réessayez.");
    } finally {
      setLoading(false);
    }
  };

  const addToCalendar = () => {
    const details = schedule.doors
      ? `Ouverture des portes à ${schedule.doors}, ${schedule.startLabel.toLowerCase()} à ${schedule.start}.`
      : `Séance à ${schedule.start}.`;
    downloadTextFile(
      "seance.ics",
      buildIcs({
        id: event.id,
        title: event.name,
        start: new Date(event.date),
        location: event.location,
        description: details,
      }),
    );
  };

  return (
    <PublicLayout
      title={event.name}
      description={`${formatDayWithYear(event.date)}${event.location ? ` · ${event.location}` : ""}. ${branding.tagline ?? ""}`.trim()}
      image={event.image?.startsWith("/") ? `${origin}${event.image}` : event.image}
    >
      <div className="mx-auto max-w-5xl px-4 pt-4 sm:px-6 sm:pt-8">
        <Link
          href="/events"
          className="mb-4 inline-flex items-center gap-1.5 rounded-lg text-sm font-medium text-subtle hover:text-ink"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Toutes les séances
        </Link>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_24rem] lg:gap-x-10">
          {/* Affiche, titre et informations pratiques */}
          <section className="space-y-6 lg:col-start-1">
            {event.image ? (
              <div className="overflow-hidden rounded-2xl bg-brand-strong shadow-card">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={event.image} alt={`Affiche de ${event.name}`} className="aspect-[16/10] w-full object-cover" />
              </div>
            ) : (
              <div className="flex aspect-[16/7] items-center justify-center rounded-2xl bg-gradient-to-br from-brand to-brand-strong text-white/30 shadow-card">
                <Clapperboard className="size-16" aria-hidden />
              </div>
            )}

            <div>
              <h1 className="text-3xl font-extrabold sm:text-4xl">{event.name}</h1>
              {event.director && <p className="mt-2 text-[0.95rem] text-subtle">Réalisé par {event.director}</p>}
            </div>

            <ul className="grid gap-4 rounded-2xl border border-line bg-surface p-4 shadow-card sm:grid-cols-2 sm:p-5">
              <Fact icon={CalendarDays} label="Date">
                {formatDayWithYear(event.date)}
              </Fact>
              {event.location && (
                <Fact icon={MapPin} label="Lieu">
                  {event.location}
                </Fact>
              )}
              {schedule.doors ? (
                <Fact icon={DoorOpen} label="Horaires" wide>
                  <span className="block">Ouverture des portes à {schedule.doors}</span>
                  <span className="block">
                    {schedule.startLabel} à {schedule.start}
                  </span>
                </Fact>
              ) : (
                <Fact icon={Clock} label="Heure" wide>
                  {schedule.start}
                </Fact>
              )}
              {runtime && (
                <Fact icon={Hourglass} label="Durée du film" wide>
                  {runtime.duration}
                  <span className="font-normal text-subtle"> · fin prévue vers {runtime.end}</span>
                </Fact>
              )}
              {remaining !== null && (
                <Fact icon={Ticket} label="Places" wide>
                  {full ? "Complet" : `${remaining} restante${remaining === 1 ? "" : "s"}`}
                </Fact>
              )}
            </ul>
          </section>

          {/* Réservation */}
          <aside className="lg:col-start-2 lg:row-span-2 lg:row-start-1">
            <div className="scroll-mt-24 lg:sticky lg:top-24" ref={resultRef}>
              {result ? (
                <div className="space-y-4">
                  <div>
                    <h2 className="text-2xl font-extrabold">{result.reused ? "Voici votre billet" : "Votre place est réservée"}</h2>
                    <p className="mt-1 text-[0.95rem] text-subtle">
                      {result.reused
                        ? "Vous aviez déjà réservé : c’est le même billet."
                        : "Présentez ce QR code à l’entrée."}
                    </p>
                  </div>

                  <TicketStub ticket={result.ticket} eventName={event.name} />

                  <div className="grid gap-2.5">
                    <Button asChild size="lg" block>
                      <a href={result.pdfUrl} download>
                        <Download aria-hidden />
                        Télécharger le billet (PDF)
                      </a>
                    </Button>
                    <Button variant="secondary" size="lg" block onClick={addToCalendar}>
                      <CalendarPlus aria-hidden />
                      Ajouter au calendrier
                    </Button>
                  </div>

                  {result.emailSent ? (
                    <Alert tone="success">
                      Un e-mail avec votre billet a été envoyé à <strong>{result.ticket.participantEmail}</strong>.
                    </Alert>
                  ) : (
                    <Alert tone="info">
                      Gardez cette page ou téléchargez votre billet. Pour le retrouver, il suffit de réserver à nouveau avec la même
                      adresse e-mail.
                    </Alert>
                  )}

                  <p className="text-center text-sm text-subtle">
                    Un empêchement ?{" "}
                    <Link href={result.manageUrl} className="font-semibold text-brand underline underline-offset-2">
                      Annuler ma réservation
                    </Link>
                  </p>
                </div>
              ) : (
                <Card className="p-5 sm:p-6">
                  <h2 className="text-2xl font-extrabold">{full ? "Retrouver mon billet" : "Réserver ma place"}</h2>
                  <p className="mt-1 text-[0.95rem] text-subtle">
                    {full
                      ? "Cette séance est complète. Si vous aviez réservé, saisissez les mêmes informations pour retrouver votre billet."
                      : "Gratuit. Votre billet s’affiche dès la réservation."}
                  </p>

                  <form onSubmit={handleSubmit} className="mt-5 space-y-4">
                    <Field label="Nom" htmlFor="name">
                      <Input
                        id="name"
                        name="name"
                        type="text"
                        autoComplete="name"
                        autoCapitalize="words"
                        required
                        maxLength={100}
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Ousmane Dembélé"
                      />
                    </Field>

                    <Field label="Adresse e-mail" htmlFor="email" hint="Utilisée pour cette réservation et pour retrouver votre billet.">
                      <Input
                        id="email"
                        name="email"
                        type="email"
                        inputMode="email"
                        autoComplete="email"
                        autoCapitalize="none"
                        required
                        maxLength={254}
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="ousmaneballondor@gmail.com"
                      />
                    </Field>

                    {error && <Alert tone="danger">{error}</Alert>}

                    <Button type="submit" variant="cta" size="lg" block loading={loading}>
                      {!loading && <Ticket aria-hidden />}
                      {loading ? "Réservation en cours" : full ? "Retrouver mon billet" : "Réserver ma place"}
                    </Button>

                    <p className="text-center text-xs text-subtle">
                      Vos données ne servent qu’à émettre votre billet.{" "}
                      <Link href="/confidentialite" className="font-medium underline underline-offset-2 hover:text-ink">
                        En savoir plus
                      </Link>
                    </p>
                  </form>
                </Card>
              )}
            </div>
          </aside>

          {/* Détails */}
          <section className="space-y-6 lg:col-start-1">
            {event.description && (
              <div>
                <h2 className="mb-2 text-xl font-bold">À propos de la séance</h2>
                <p className="whitespace-pre-line text-[0.95rem] leading-relaxed text-ink/85">{event.description}</p>
              </div>
            )}

            <div className="rounded-2xl bg-brand-tint p-4 ring-1 ring-brand/10 sm:p-5">
              <h2 className="mb-3 flex items-center gap-2 text-lg font-bold">
                <Info className="size-5 text-brand" aria-hidden />
                Bon à savoir
              </h2>
              <ul className="space-y-2.5 text-[0.95rem] text-ink/85">
                <li className="flex gap-3">
                  <Smartphone className="mt-0.5 size-5 shrink-0 text-brand" aria-hidden />
                  Présentez le QR code de votre billet à l’entrée.
                </li>
                <li className="flex gap-3">
                  <Ticket className="mt-0.5 size-5 shrink-0 text-brand" aria-hidden />
                  Un billet par personne : une adresse e-mail ne peut réserver qu’une place par séance.
                </li>
                {branding.eventTermsText && (
                  <li className="flex gap-3">
                    <Info className="mt-0.5 size-5 shrink-0 text-brand" aria-hidden />
                    {branding.eventTermsText}
                  </li>
                )}
              </ul>
            </div>
          </section>
        </div>
      </div>
    </PublicLayout>
  );
}
