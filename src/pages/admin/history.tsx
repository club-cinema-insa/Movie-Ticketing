import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  CalendarPlus,
  Eye,
  EyeOff,
  History,
  Pencil,
  ShieldMinus,
  ShieldPlus,
  Trash2,
  Undo2,
  UserCheck,
  UserMinus,
  UserPlus,
  type LucideIcon,
} from "lucide-react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Select } from "@/components/ui/field";
import { PageSpinner } from "@/components/ui/spinner";
import { RETENTION_MONTHS } from "@/config/retention";
import { formatDayWithYear, formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";

type Entry = {
  id: string;
  createdAt: string;
  action: string;
  actorName: string | null;
  eventId: string | null;
  eventName: string | null;
  detail: string | null;
};

type EventOption = { id: string; name: string; date: string };

const CATEGORIES = [
  { key: "", label: "Tout" },
  { key: "events", label: "Séances" },
  { key: "tickets", label: "Réservations" },
  { key: "access", label: "Accès" },
] as const;

type Tone = "brand" | "success" | "accent" | "danger";

const TONES: Record<Tone, string> = {
  brand: "bg-brand-soft text-brand-strong",
  success: "bg-success-soft text-success",
  accent: "bg-accent-soft text-[#7a4300]",
  danger: "bg-danger-soft text-danger",
};

/** Phrase d'une entrée : qui, quoi, sur quelle séance. */
function describe(entry: Entry): { icon: LucideIcon; tone: Tone; text: React.ReactNode } {
  const actor = <strong className="font-semibold">{entry.actorName ?? "Un membre du bureau"}</strong>;
  const person = <strong className="font-semibold">{entry.detail ?? "une personne"}</strong>;
  const event = entry.eventName ? <strong className="font-semibold">« {entry.eventName} »</strong> : "une séance";

  switch (entry.action) {
    case "event.create":
      return { icon: CalendarPlus, tone: "brand", text: <>{actor} a créé la séance {event}{entry.detail ? ` (${entry.detail})` : ""}.</> };
    case "event.update":
      return { icon: Pencil, tone: "brand", text: <>{actor} a modifié la séance {event}{entry.detail ? ` : ${entry.detail}` : ""}.</> };
    case "event.publish":
      return { icon: Eye, tone: "success", text: <>{actor} a publié la séance {event}.</> };
    case "event.unpublish":
      return { icon: EyeOff, tone: "accent", text: <>{actor} a repassé la séance {event} en brouillon.</> };
    case "event.delete":
      return { icon: Trash2, tone: "danger", text: <>{actor} a supprimé la séance {event}{entry.detail ? ` (${entry.detail})` : ""}.</> };
    case "ticket.add":
      return { icon: UserPlus, tone: "success", text: <>{actor} a ajouté {person} à la séance {event}.</> };
    case "ticket.cancel":
      return { icon: UserMinus, tone: "danger", text: <>{actor} a annulé la réservation de {person} pour {event}.</> };
    case "ticket.cancel_by_student":
      return { icon: UserMinus, tone: "accent", text: <>{person} a annulé sa réservation pour {event}.</> };
    case "ticket.checkin":
      return { icon: UserCheck, tone: "success", text: <>{actor} a validé à la main l’entrée de {person} ({event}).</> };
    case "ticket.uncheckin":
      return { icon: Undo2, tone: "accent", text: <>{actor} a annulé la validation de {person} ({event}).</> };
    case "access.add":
      return { icon: ShieldPlus, tone: "success", text: <>{actor} a autorisé {person} à se connecter à l’espace bureau.</> };
    case "access.remove":
      return { icon: ShieldMinus, tone: "danger", text: <>{actor} a retiré l’accès de {person}.</> };
    default:
      return { icon: History, tone: "brand", text: <>{actor} : {entry.action}.</> };
  }
}

function HistoryContent() {
  const { status } = useSession();
  const [category, setCategory] = useState("");
  const [eventId, setEventId] = useState("");
  const [events, setEvents] = useState<EventOption[]>([]);
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(
    async (cursor: string | null) => {
      const params = new URLSearchParams();
      if (category) params.set("category", category);
      if (eventId) params.set("eventId", eventId);
      if (cursor) params.set("cursor", cursor);
      const res = await fetch(`/api/admin/audit?${params.toString()}`);
      if (!res.ok) throw new Error(String(res.status));
      return (await res.json()) as { entries: Entry[]; nextCursor: string | null };
    },
    [category, eventId],
  );

  useEffect(() => {
    if (status !== "authenticated") return;
    let cancelled = false;
    setEntries(null);
    load(null)
      .then((data) => {
        if (cancelled) return;
        setEntries(data.entries);
        setNextCursor(data.nextCursor);
        setError("");
      })
      .catch(() => !cancelled && setError("Impossible de charger l’historique. Rechargez la page."));
    return () => {
      cancelled = true;
    };
  }, [status, load]);

  useEffect(() => {
    if (status !== "authenticated") return;
    void fetch("/api/admin/events")
      .then((res) => (res.ok ? (res.json() as Promise<EventOption[]>) : []))
      .then((data) => setEvents([...data].sort((a, b) => b.date.localeCompare(a.date))))
      .catch(() => undefined);
  }, [status]);

  const loadMore = async () => {
    if (!nextCursor) return;
    setLoadingMore(true);
    try {
      const data = await load(nextCursor);
      setEntries((current) => [...(current ?? []), ...data.entries]);
      setNextCursor(data.nextCursor);
    } catch {
      setError("Impossible de charger la suite. Réessayez.");
    } finally {
      setLoadingMore(false);
    }
  };

  // Regroupement par jour (fuseau de Paris), dans l'ordre d'arrivée.
  const days: { label: string; items: Entry[] }[] = [];
  for (const entry of entries ?? []) {
    const label = formatDayWithYear(entry.createdAt);
    const last = days[days.length - 1];
    if (last?.label === label) last.items.push(entry);
    else days.push({ label, items: [entry] });
  }

  return (
    <>
      <PageHeader
        title="Historique"
        description={`Qui a fait quoi dans l’espace bureau. Conservé ${RETENTION_MONTHS} mois.`}
      />

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div role="group" aria-label="Type d’action" className="flex flex-wrap gap-1.5">
          {CATEGORIES.map((item) => (
            <Button
              key={item.key}
              size="sm"
              variant={category === item.key ? "primary" : "soft"}
              aria-pressed={category === item.key}
              onClick={() => setCategory(item.key)}
            >
              {item.label}
            </Button>
          ))}
        </div>
        <Select
          aria-label="Filtrer par séance"
          value={eventId}
          onChange={(e) => setEventId(e.target.value)}
          className="sm:max-w-xs"
        >
          <option value="">Toutes les séances</option>
          {events.map((event) => (
            <option key={event.id} value={event.id}>
              {event.name}
            </option>
          ))}
        </Select>
      </div>

      {error && (
        <Alert tone="danger" className="mb-5">
          {error}
        </Alert>
      )}

      {!entries ? (
        error ? null : <PageSpinner label="Chargement de l’historique" />
      ) : entries.length === 0 ? (
        <EmptyState
          icon={History}
          title="Rien à afficher"
          description="Les actions du bureau (séances, réservations, accès) apparaîtront ici à partir de maintenant."
          action={
            <Button asChild variant="soft">
              <Link href="/admin/events">Voir les séances</Link>
            </Button>
          }
        />
      ) : (
        <div className="space-y-6">
          {days.map((day) => (
            <section key={day.label} aria-label={day.label}>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-subtle first-letter:uppercase">{day.label}</h2>
              <Card className="divide-y divide-line">
                {day.items.map((entry) => {
                  const { icon: Icon, tone, text } = describe(entry);
                  return (
                    <div key={entry.id} className="flex items-start gap-3.5 p-3.5 sm:p-4">
                      <span className={cn("mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-xl", TONES[tone])}>
                        <Icon className="size-[1.15rem]" aria-hidden />
                      </span>
                      <p className="min-w-0 flex-1 text-[0.95rem] leading-snug">{text}</p>
                      <time dateTime={entry.createdAt} className="shrink-0 pt-0.5 text-sm tabular text-subtle">
                        {formatTime(entry.createdAt)}
                      </time>
                    </div>
                  );
                })}
              </Card>
            </section>
          ))}

          {nextCursor && (
            <div className="text-center">
              <Button variant="secondary" loading={loadingMore} onClick={() => void loadMore()}>
                Voir plus
              </Button>
            </div>
          )}
        </div>
      )}
    </>
  );
}

export default function HistoryPage() {
  return (
    <AdminLayout title="Historique">
      <HistoryContent />
    </AdminLayout>
  );
}
