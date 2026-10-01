import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  CalendarDays,
  Clapperboard,
  Eye,
  EyeOff,
  FileText,
  MapPin,
  Pencil,
  Plus,
  ScanLine,
  Ticket,
  Trash2,
  Users,
} from "lucide-react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { PageSpinner } from "@/components/ui/spinner";
import { Stat } from "@/components/ui/stat";
import { formatDay, formatTime } from "@/lib/format";

type AdminEvent = {
  id: string;
  name: string;
  date: string;
  location: string | null;
  image: string | null;
  show: boolean;
  maxTickets: number | null;
  checkedInCount?: number;
  /** Publier enverra une annonce sur Discord. */
  canAnnounce?: boolean;
  _count: { tickets: number };
};

function EventRow({
  event,
  onToggle,
  onDelete,
  compact = false,
}: {
  event: AdminEvent;
  onToggle: (event: AdminEvent) => void;
  onDelete: (event: AdminEvent) => void;
  compact?: boolean;
}) {
  const issued = event._count.tickets;
  const checkedIn = event.checkedInCount ?? 0;
  const progress = event.maxTickets ? Math.min(100, (issued / event.maxTickets) * 100) : 0;

  return (
    <Card className="overflow-hidden">
      <div className="flex gap-3.5 p-3.5 sm:gap-4 sm:p-4">
        <div className="relative h-24 w-[4.5rem] shrink-0 overflow-hidden rounded-xl bg-brand-strong sm:h-28 sm:w-36">
          {event.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={event.image} alt="" loading="lazy" className="size-full object-cover" />
          ) : (
            <div className="flex size-full items-center justify-center text-white/35">
              <Clapperboard className="size-8" aria-hidden />
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex flex-wrap items-center gap-2">
            {event.show ? (
              <Badge tone="success">
                <Eye aria-hidden />
                Publiée
              </Badge>
            ) : (
              <Badge tone="neutral">
                <FileText aria-hidden />
                Brouillon
              </Badge>
            )}
          </div>

          <h3 className="truncate font-display text-lg font-bold leading-tight sm:text-xl">{event.name}</h3>

          <p className="mt-1 flex items-center gap-1.5 text-sm text-subtle">
            <CalendarDays className="size-4 shrink-0" aria-hidden />
            <span className="truncate first-letter:uppercase">
              {formatDay(event.date)} · {formatTime(event.date)}
            </span>
          </p>
          {event.location && (
            <p className="mt-0.5 flex items-center gap-1.5 text-sm text-subtle">
              <MapPin className="size-4 shrink-0" aria-hidden />
              <span className="truncate">{event.location}</span>
            </p>
          )}

          <div className="mt-3">
            {event.maxTickets ? (
              <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
                <div
                  className={`h-full rounded-full transition-all ${progress >= 100 ? "bg-accent" : "bg-highlight"}`}
                  style={{ width: `${progress}%` }}
                />
              </div>
            ) : null}
            <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm">
              <span className="inline-flex items-center gap-1.5 font-semibold">
                <Ticket className="size-4 text-brand" aria-hidden />
                <span className="tabular">
                  {issued}
                  {event.maxTickets ? ` / ${event.maxTickets}` : ""}
                </span>{" "}
                <span className="font-normal text-subtle">réservation{issued > 1 ? "s" : ""}</span>
              </span>
              <span className="text-subtle">
                <span className="tabular font-semibold text-ink">{checkedIn}</span> présent{checkedIn > 1 ? "s" : ""}
              </span>
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border-t border-line bg-muted/50 px-3.5 py-3 sm:px-4">
        {!event.show && (
          <Button size="sm" onClick={() => onToggle(event)}>
            <Eye aria-hidden />
            Publier
          </Button>
        )}
        <Button asChild size="sm" variant="soft">
          <Link href={`/admin/events/${event.id}/participants`}>
            <Users aria-hidden />
            Réservations
          </Link>
        </Button>
        {!compact && (
          <Button asChild size="sm" variant="soft">
            <Link href={`/verify?event=${event.id}`}>
              <ScanLine aria-hidden />
              Contrôler
            </Link>
          </Button>
        )}
        <Button asChild size="sm" variant="secondary">
          <Link href={`/admin/events/${event.id}/edit`}>
            <Pencil aria-hidden />
            Modifier
          </Link>
        </Button>
        {event.show && (
          <Button size="sm" variant="ghost" onClick={() => onToggle(event)}>
            <EyeOff aria-hidden />
            Masquer
          </Button>
        )}
        <Button
          size="icon-sm"
          variant="danger-soft"
          className="ml-auto"
          aria-label={`Supprimer « ${event.name} »`}
          title="Supprimer"
          onClick={() => onDelete(event)}
        >
          <Trash2 aria-hidden />
        </Button>
      </div>
    </Card>
  );
}

function DashboardContent() {
  const { status } = useSession();
  const [events, setEvents] = useState<AdminEvent[] | null>(null);
  const [error, setError] = useState("");
  const [toDelete, setToDelete] = useState<AdminEvent | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [toPublish, setToPublish] = useState<AdminEvent | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/events");
      if (!res.ok) throw new Error(String(res.status));
      setEvents((await res.json()) as AdminEvent[]);
    } catch {
      setError("Impossible de charger les séances. Rechargez la page.");
    }
  }, []);

  useEffect(() => {
    if (status === "authenticated") void load();
  }, [status, load]);

  // Publier une séance non encore annoncée envoie un message avec @everyone : on demande confirmation.
  const requestToggle = (event: AdminEvent) => {
    if (!event.show && event.canAnnounce) setToPublish(event);
    else void toggleVisibility(event);
  };

  const toggleVisibility = async (event: AdminEvent) => {
    const next = !event.show;
    setError("");
    setEvents((current) => current?.map((item) => (item.id === event.id ? { ...item, show: next } : item)) ?? null);

    const res = await fetch(`/api/admin/events/${event.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ show: next }),
    });
    if (!res.ok) {
      setEvents((current) => current?.map((item) => (item.id === event.id ? { ...item, show: event.show } : item)) ?? null);
      setError("La visibilité n’a pas pu être modifiée. Réessayez.");
    }
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    const res = await fetch(`/api/admin/events/${toDelete.id}`, { method: "DELETE" });
    setDeleting(false);
    setToDelete(null);
    if (res.ok) {
      await load();
    } else {
      setError("La séance n’a pas pu être supprimée. Réessayez.");
    }
  };

  if (!events) {
    return error ? <Alert tone="danger">{error}</Alert> : <PageSpinner label="Chargement des séances" />;
  }

  // Une séance reste « à venir » jusqu'à la fin de la journée.
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const upcoming = events.filter((event) => new Date(event.date).getTime() >= startOfToday.getTime());
  const past = events.filter((event) => new Date(event.date).getTime() < startOfToday.getTime()).reverse();
  const upcomingReservations = upcoming.reduce((sum, event) => sum + event._count.tickets, 0);
  const drafts = upcoming.filter((event) => !event.show).length;

  return (
    <>
      <PageHeader
        title="Séances"
        description="Créez, publiez et suivez les séances du club."
        actions={
          <Button asChild variant="cta" size="lg">
            <Link href="/admin/events/new">
              <Plus aria-hidden />
              Nouvelle séance
            </Link>
          </Button>
        }
      />

      {error && (
        <Alert tone="danger" className="mb-5">
          {error}
        </Alert>
      )}

      <div className="mb-8 grid grid-cols-3 gap-3 sm:gap-4">
        <Stat icon={CalendarDays} label="Séances à venir" value={upcoming.length} />
        <Stat icon={Ticket} label="Réservations à venir" value={upcomingReservations} tone="success" />
        <Stat icon={FileText} label={drafts > 1 ? "Brouillons" : "Brouillon"} value={drafts} tone="accent" />
      </div>

      <section aria-labelledby="upcoming-title">
        <h2 id="upcoming-title" className="mb-4 text-xl font-bold">
          À venir
        </h2>
        {upcoming.length === 0 ? (
          <EmptyState
            icon={Clapperboard}
            title="Aucune séance à venir"
            description="Créez la prochaine séance : le lieu, l’heure et le nombre de places sont préremplis."
            action={
              <Button asChild variant="cta">
                <Link href="/admin/events/new">
                  <Plus aria-hidden />
                  Nouvelle séance
                </Link>
              </Button>
            }
          />
        ) : (
          <ul className="space-y-4">
            {upcoming.map((event) => (
              <li key={event.id}>
                <EventRow event={event} onToggle={requestToggle} onDelete={setToDelete} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {past.length > 0 && (
        <details className="group mt-10">
          <summary className="flex cursor-pointer list-none items-center justify-between rounded-xl text-xl font-bold [&::-webkit-details-marker]:hidden">
            <span>
              Séances passées <span className="text-base font-semibold text-subtle">({past.length})</span>
            </span>
            <span className="text-sm font-semibold text-brand group-open:hidden">Afficher</span>
            <span className="hidden text-sm font-semibold text-brand group-open:inline">Masquer</span>
          </summary>
          <ul className="mt-4 space-y-4">
            {past.map((event) => (
              <li key={event.id}>
                <EventRow event={event} onToggle={requestToggle} onDelete={setToDelete} compact />
              </li>
            ))}
          </ul>
        </details>
      )}

      <ConfirmDialog
        open={toPublish !== null}
        onOpenChange={(open) => !open && setToPublish(null)}
        title={toPublish ? `Publier « ${toPublish.name} » ?` : ""}
        description="La séance devient visible sur le site et une annonce avec @everyone est envoyée sur Discord. Cette annonce n’est envoyée qu’une fois."
        confirmLabel="Publier et annoncer"
        cancelLabel="Pas maintenant"
        tone="primary"
        onConfirm={() => {
          const event = toPublish;
          setToPublish(null);
          if (event) void toggleVisibility(event);
        }}
      />

      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(open) => !open && setToDelete(null)}
        title={toDelete ? `Supprimer « ${toDelete.name} » ?` : ""}
        description={
          toDelete && (
            <>
              {toDelete._count.tickets > 0
                ? `Les ${toDelete._count.tickets} réservation${toDelete._count.tickets > 1 ? "s" : ""} de cette séance seront supprimées avec elle. `
                : ""}
              Cette action est définitive.
            </>
          )
        }
        confirmLabel="Supprimer"
        loading={deleting}
        onConfirm={confirmDelete}
      />
    </>
  );
}

export default function AdminEventsPage() {
  return (
    <AdminLayout title="Séances">
      <DashboardContent />
    </AdminLayout>
  );
}
