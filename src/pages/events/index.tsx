import Link from "next/link";
import type { GetServerSideProps } from "next";
import { ArrowRight, Clapperboard, Clock, MapPin, Ticket } from "lucide-react";
import { db } from "@/server/db";
import { branding } from "@/config/branding";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { dateBadgeParts, eventSchedule, remainingSeats } from "@/lib/format";

type PublicEvent = {
  id: string;
  name: string;
  date: string;
  description: string | null;
  location: string | null;
  image: string | null;
  maxTickets: number | null;
  startOffsetMinutes: number | null;
  issued: number;
};

export const getServerSideProps: GetServerSideProps<{ events: PublicEvent[] }> = async () => {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const events = await db.event.findMany({
    where: { show: true, date: { gte: startOfToday } },
    orderBy: { date: "asc" },
    include: { _count: { select: { tickets: true } } },
  });

  return {
    props: {
      events: events.map((event) => ({
        id: event.id,
        name: event.name,
        date: event.date.toISOString(),
        description: event.description,
        location: event.location,
        image: event.image,
        maxTickets: event.maxTickets,
        startOffsetMinutes: event.startOffsetMinutes,
        issued: event._count.tickets,
      })),
    },
  };
};

function Hero() {
  return (
    <section className="relative isolate overflow-hidden bg-brand-strong text-white">
      <div
        aria-hidden
        className="absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(48rem 26rem at 88% -15%, color-mix(in oklab, var(--highlight) 42%, transparent), transparent 62%), radial-gradient(36rem 22rem at -8% 115%, color-mix(in oklab, var(--accent) 32%, transparent), transparent 62%)",
        }}
      />
      {/* Bande de pellicule */}
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 -z-10 h-2.5 opacity-50"
        style={{
          backgroundImage: "repeating-linear-gradient(90deg, transparent 0 9px, rgb(255 255 255 / 0.35) 9px 19px)",
        }}
      />

      <div className="mx-auto flex max-w-5xl items-center justify-between gap-8 px-4 pb-14 pt-10 sm:px-6 sm:pb-20 sm:pt-16">
        <div className="min-w-0">
          <Badge tone="inverse" className="mb-4">
            <Clapperboard aria-hidden />
            {branding.appName}
          </Badge>
          <h1 className="text-[2.6rem] font-extrabold leading-[1.02] sm:text-6xl">
            Les prochaines
            <br />
            <span className="text-highlight">séances</span>
          </h1>
          {branding.tagline && <p className="mt-4 max-w-md text-lg text-white/80">{branding.tagline}</p>}
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={branding.logoUrl}
          alt=""
          width={176}
          height={176}
          className="hidden size-40 shrink-0 -rotate-6 rounded-[2rem] shadow-pop ring-4 ring-white/15 sm:block lg:size-44"
        />
      </div>
    </section>
  );
}

function EventCard({ event }: { event: PublicEvent }) {
  const badge = dateBadgeParts(event.date);
  const schedule = eventSchedule(event.date, event.startOffsetMinutes);
  const remaining = remainingSeats(event.maxTickets, event.issued);
  const full = remaining === 0;
  const href = `/events/${event.id}/register`;

  return (
    <article className="group flex w-full flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-card transition duration-200 hover:-translate-y-0.5 hover:shadow-pop">
      <Link href={href} className="relative block aspect-[16/10] overflow-hidden bg-brand-strong" tabIndex={-1} aria-hidden>
        {event.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={event.image}
            alt=""
            loading="lazy"
            decoding="async"
            className="size-full object-cover transition duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex size-full items-center justify-center bg-gradient-to-br from-brand to-brand-strong text-white/30">
            <Clapperboard className="size-16" aria-hidden />
          </div>
        )}
        <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-ink/45 via-transparent to-transparent" />

        <div className="absolute left-3 top-3 w-14 rounded-xl bg-surface py-1.5 text-center shadow-card">
          <p className="text-[0.65rem] font-bold uppercase leading-none tracking-wide text-subtle">{badge.weekday}</p>
          <p className="font-display text-2xl font-extrabold leading-tight">{badge.day}</p>
          <p className="text-[0.65rem] font-bold uppercase leading-none tracking-wide text-brand">{badge.month}</p>
        </div>

        {(full || (remaining !== null && remaining <= 10)) && (
          <Badge tone={full ? "danger" : "accent"} className="absolute right-3 top-3 shadow-card">
            {full ? "Complet" : `Plus que ${remaining} place${remaining === 1 ? "" : "s"}`}
          </Badge>
        )}
      </Link>

      <div className="flex flex-1 flex-col gap-3 p-4 sm:p-5">
        <h2 className="line-clamp-2 text-xl font-bold leading-tight">
          <Link href={href} className="rounded-md hover:text-brand">
            {event.name}
          </Link>
        </h2>

        <ul className="space-y-1.5 text-sm text-subtle">
          <li className="flex items-center gap-2">
            <Clock className="size-4 shrink-0 text-brand" aria-hidden />
            {schedule.doors ? `Portes ${schedule.doors} · Début ${schedule.start}` : schedule.start}
          </li>
          {event.location && (
            <li className="flex items-center gap-2">
              <MapPin className="size-4 shrink-0 text-brand" aria-hidden />
              <span className="truncate">{event.location}</span>
            </li>
          )}
          {remaining !== null && !full && remaining > 10 && (
            <li className="flex items-center gap-2">
              <Ticket className="size-4 shrink-0 text-brand" aria-hidden />
              {remaining} places disponibles
            </li>
          )}
        </ul>

        {event.description && <p className="line-clamp-2 text-sm text-ink/75">{event.description}</p>}

        <div className="mt-auto pt-2">
          <Button asChild variant={full ? "secondary" : "cta"} block>
            <Link href={href}>
              {full ? "Retrouver mon billet" : "Réserver ma place"}
              <ArrowRight aria-hidden />
            </Link>
          </Button>
        </div>
      </div>
    </article>
  );
}

export default function EventsPage({ events }: { events: PublicEvent[] }) {
  return (
    <PublicLayout title="Prochaines séances">
      <Hero />

      <section className="mx-auto max-w-5xl px-4 pt-8 sm:px-6 sm:pt-12" aria-labelledby="upcoming">
        <h2 id="upcoming" className="sr-only">
          Séances à venir
        </h2>

        {events.length === 0 ? (
          <EmptyState
            icon={Clapperboard}
            title="Aucune séance programmée"
            description="Revenez bientôt : les prochaines séances seront annoncées ici."
          />
        ) : (
          <ul className="grid gap-5 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
            {events.map((event) => (
              <li key={event.id} className="flex">
                <EventCard event={event} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </PublicLayout>
  );
}
