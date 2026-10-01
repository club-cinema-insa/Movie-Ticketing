import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { ChartColumn, Clapperboard, Gauge, Percent, Ticket, UserCheck, Users } from "lucide-react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageSpinner } from "@/components/ui/spinner";
import { Stat } from "@/components/ui/stat";
import { dateBadgeParts, formatDayShort } from "@/lib/format";
import type { SessionStats, StatsResponse } from "@/server/stats/compute";

const PERIODS = [
  { months: 0, label: "Tout" },
  { months: 12, label: "12 mois" },
  { months: 6, label: "6 mois" },
  { months: 3, label: "3 mois" },
] as const;

const percent = (value: number | null) => (value === null ? "–" : `${Math.round(value * 100)}`);
const oneDecimal = (value: number | null) => (value === null ? "–" : (Math.round(value * 10) / 10).toString().replace(".", ","));

/** Graduations « rondes » de l'axe : 0, 10, 20… jusqu'à la valeur la plus haute. */
function axisTicks(highest: number): number[] {
  const step = highest <= 60 ? 10 : highest <= 150 ? 20 : highest <= 300 ? 50 : 100;
  const max = Math.max(step, Math.ceil(highest / step) * step);
  return Array.from({ length: max / step + 1 }, (_, index) => index * step);
}

/** Barres par séance : réservations et présents, avec le nombre de places en pointillés. */
function SessionsChart({ sessions }: { sessions: SessionStats[] }) {
  // L'échelle suit les réservations : une grande salle ne doit pas écraser les séances plus petites.
  const ticks = axisTicks(Math.max(1, ...sessions.map((session) => session.reservations)));
  const max = ticks[ticks.length - 1]!;
  const chartWidth = `max(100%, ${sessions.length * 3.4}rem)`;

  // Sur téléphone, le graphique défile : on affiche d'abord les séances les plus récentes.
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (scroller.current) scroller.current.scrollLeft = scroller.current.scrollWidth;
  }, [sessions]);

  return (
    <Card className="p-4 sm:p-5">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold">Séance par séance</h2>
        <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-subtle" aria-label="Légende">
          <li className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-[3px] bg-brand" aria-hidden />
            Réservations
          </li>
          <li className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-[3px] bg-accent" aria-hidden />
            Présents
          </li>
          <li className="flex items-center gap-1.5">
            <span className="w-4 border-t-2 border-dashed border-ink/55" aria-hidden />
            Places
          </li>
        </ul>
      </div>

      <div className="flex">
        {/* Axe vertical, fixe pendant le défilement horizontal */}
        <div className="relative h-44 w-8 shrink-0" aria-hidden>
          {ticks.map((tick) => (
            <span
              key={tick}
              className="absolute right-2 -translate-y-1/2 text-[0.7rem] leading-none text-subtle tabular"
              style={{ bottom: `${(tick / max) * 100}%` }}
            >
              {tick}
            </span>
          ))}
        </div>

        <div ref={scroller} className="min-w-0 flex-1 overflow-x-auto">
          <div style={{ width: chartWidth }}>
            <div className="relative h-44">
              {ticks.map((tick) => (
                <span
                  key={tick}
                  className={`absolute inset-x-0 border-t ${tick === 0 ? "border-line-strong" : "border-line"}`}
                  style={{ bottom: `${(tick / max) * 100}%` }}
                  aria-hidden
                />
              ))}

              <ol className="absolute inset-0 flex gap-2.5">
                {sessions.map((session) => (
                  <li
                    key={session.id}
                    className="relative flex min-w-[2.6rem] flex-1 items-end justify-center gap-[3px]"
                    title={`${session.name} : ${session.reservations} réservation${session.reservations > 1 ? "s" : ""}, ${session.attendees} présent${session.attendees > 1 ? "s" : ""}${session.capacity ? `, ${session.capacity} places` : ""}`}
                  >
                    <span
                      className="w-3.5 rounded-t-[5px] bg-brand sm:w-4"
                      style={{ height: `${(session.reservations / max) * 100}%`, minHeight: session.reservations > 0 ? 3 : 0 }}
                      aria-hidden
                    />
                    <span
                      className="w-3.5 rounded-t-[5px] bg-accent sm:w-4"
                      style={{ height: `${(session.attendees / max) * 100}%`, minHeight: session.attendees > 0 ? 3 : 0 }}
                      aria-hidden
                    />
                    {session.capacity !== null && session.capacity <= max && (
                      <span
                        className="absolute inset-x-0 border-t-2 border-dashed border-ink/55"
                        style={{ bottom: `${(session.capacity / max) * 100}%` }}
                        aria-hidden
                      />
                    )}
                  </li>
                ))}
              </ol>
            </div>

            <ol className="mt-2.5 flex gap-2.5">
              {sessions.map((session) => {
                const badge = dateBadgeParts(session.date);
                return (
                  <li key={session.id} className="min-w-[2.6rem] flex-1 text-center leading-tight">
                    <span className="block text-sm font-bold tabular">{badge.day}</span>
                    <span className="block text-[0.7rem] font-medium text-subtle">{badge.month}</span>
                    <span className="mt-1 block text-[0.7rem] font-semibold tabular">
                      <span className="text-brand">{session.reservations}</span>
                      <span className="text-subtle"> · </span>
                      <span className="text-[#8a5200]">{session.attendees}</span>
                    </span>
                  </li>
                );
              })}
            </ol>
          </div>
        </div>
      </div>
    </Card>
  );
}

function SessionRow({ session }: { session: SessionStats }) {
  return (
    <li className="flex flex-col gap-2 py-3.5 sm:flex-row sm:items-center sm:gap-5">
      <div className="min-w-0 sm:w-64">
        <p className="truncate font-semibold">{session.name}</p>
        <p className="text-sm text-subtle first-letter:uppercase">{formatDayShort(session.date)}</p>
      </div>

      <div className="min-w-0 flex-1">
        {session.fillRate !== null && (
          <div className="mb-1.5 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
            <div className="h-full rounded-full bg-highlight" style={{ width: `${session.fillRate * 100}%` }} />
          </div>
        )}
        <p className="flex flex-wrap gap-x-4 gap-y-0.5 text-sm">
          <span>
            <span className="font-semibold tabular">
              {session.reservations}
              {session.capacity ? ` / ${session.capacity}` : ""}
            </span>{" "}
            <span className="text-subtle">réservation{session.reservations > 1 ? "s" : ""}</span>
          </span>
          <span>
            <span className="font-semibold tabular">{session.attendees}</span>{" "}
            <span className="text-subtle">présent{session.attendees > 1 ? "s" : ""}</span>
            {session.attendanceRate !== null && (
              <span className="text-subtle tabular"> ({percent(session.attendanceRate)} %)</span>
            )}
          </span>
          {session.newParticipants > 0 && (
            <span className="text-subtle">
              dont <span className="font-semibold tabular text-ink">{session.newParticipants}</span> nouveau
              {session.newParticipants > 1 ? "x" : ""}
            </span>
          )}
        </p>
      </div>
    </li>
  );
}

const LEAD_TIME_LABELS: { key: keyof StatsResponse["leadTime"]; label: string }[] = [
  { key: "overAWeek", label: "Plus d’une semaine avant" },
  { key: "threeToSevenDays", label: "3 à 7 jours avant" },
  { key: "oneToTwoDays", label: "1 à 2 jours avant" },
  { key: "sameDay", label: "Le jour même" },
];

function LeadTime({ leadTime }: { leadTime: StatsResponse["leadTime"] }) {
  const total = Object.values(leadTime).reduce((sum, count) => sum + count, 0);
  if (total === 0) return null;

  return (
    <Card className="p-4 sm:p-5">
      <h2 className="text-lg font-bold">Quand réserve-t-on ?</h2>
      <p className="mt-0.5 text-sm text-subtle">Délai entre la réservation et la séance, utile pour choisir quand communiquer.</p>
      <ul className="mt-4 space-y-3">
        {LEAD_TIME_LABELS.map(({ key, label }) => {
          const share = leadTime[key] / total;
          return (
            <li key={key}>
              <div className="mb-1 flex items-baseline justify-between text-sm">
                <span>{label}</span>
                <span className="tabular">
                  <span className="font-semibold">{Math.round(share * 100)} %</span>{" "}
                  <span className="text-subtle">({leadTime[key]})</span>
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
                <div className="h-full rounded-full bg-brand" style={{ width: `${share * 100}%` }} />
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

function StatsContent() {
  const { status } = useSession();
  const [months, setMonths] = useState(0);
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (status !== "authenticated") return;
    let cancelled = false;

    const load = async () => {
      try {
        const res = await fetch(`/api/admin/stats?months=${months}`);
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as StatsResponse;
        if (!cancelled) {
          setStats(data);
          setError("");
        }
      } catch {
        if (!cancelled) setError("Impossible de charger les statistiques. Rechargez la page.");
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [status, months]);

  const header = (
    <PageHeader
      title="Statistiques"
      description="Fréquentation des séances passées."
      actions={
        <div role="group" aria-label="Période" className="flex gap-1.5">
          {PERIODS.map((period) => (
            <Button
              key={period.months}
              size="sm"
              variant={months === period.months ? "primary" : "soft"}
              aria-pressed={months === period.months}
              onClick={() => setMonths(period.months)}
            >
              {period.label}
            </Button>
          ))}
        </div>
      }
    />
  );

  if (!stats) {
    return (
      <>
        {header}
        {error ? <Alert tone="danger">{error}</Alert> : <PageSpinner label="Chargement des statistiques" />}
      </>
    );
  }

  const { totals, sessions, upcoming } = stats;

  return (
    <>
      {header}
      {error && (
        <Alert tone="danger" className="mb-5">
          {error}
        </Alert>
      )}

      {sessions.length === 0 ? (
        <EmptyState
          icon={ChartColumn}
          title="Pas encore de statistiques"
          description={
            stats.months > 0
              ? "Aucune séance passée sur cette période."
              : "Elles apparaîtront après la première séance, à partir des réservations et des billets validés à l’entrée."
          }
          action={
            <Button asChild variant="soft">
              <Link href="/admin/events">Voir les séances</Link>
            </Button>
          }
        />
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
            <Stat icon={Clapperboard} label={totals.sessions > 1 ? "Séances passées" : "Séance passée"} value={totals.sessions} />
            <Stat icon={Ticket} label="Réservations" value={totals.reservations} />
            <Stat icon={UserCheck} label="Présents" value={totals.attendees} tone="success" />
            <Stat
              icon={Percent}
              label="Réservations honorées"
              value={percent(totals.attendanceRate)}
              suffix={totals.attendanceRate === null ? undefined : "%"}
              tone="success"
            />
            <Stat
              icon={Gauge}
              label="Remplissage moyen"
              value={percent(totals.averageFill)}
              suffix={totals.averageFill === null ? undefined : "%"}
              tone="accent"
            />
            <Stat icon={Users} label="Spectateurs différents" value={totals.uniqueParticipants} tone="accent" />
          </div>

          <p className="text-sm text-subtle">
            {oneDecimal(totals.averageAttendees)} présent{(totals.averageAttendees ?? 0) >= 2 ? "s" : ""} en moyenne par séance.{" "}
            {totals.uniqueParticipants > 0 && (
              <>
                {totals.returningParticipants} spectateur{totals.returningParticipants > 1 ? "s" : ""} sur{" "}
                {totals.uniqueParticipants} {totals.returningParticipants > 1 ? "sont venus" : "est venu"} à plusieurs séances
                {upcoming.sessions > 0 &&
                  `. À venir : ${upcoming.sessions} séance${upcoming.sessions > 1 ? "s" : ""}, ${upcoming.reservations} réservation${upcoming.reservations > 1 ? "s" : ""}`}
                .
              </>
            )}
          </p>

          <SessionsChart sessions={sessions} />

          <Card className="p-4 sm:p-5">
            <h2 className="text-lg font-bold">Détail par séance</h2>
            <ul className="mt-1 divide-y divide-line">
              {[...sessions].reverse().map((session) => (
                <SessionRow key={session.id} session={session} />
              ))}
            </ul>
          </Card>

          <LeadTime leadTime={stats.leadTime} />

          <p className="text-xs text-subtle">
            Les présents sont les billets validés à l’entrée (scan ou validation manuelle). Les réservations annulées ne sont pas
            comptées.
          </p>
        </div>
      )}
    </>
  );
}

export default function StatsPage() {
  return (
    <AdminLayout title="Statistiques">
      <StatsContent />
    </AdminLayout>
  );
}
