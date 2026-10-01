import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import {
  Check,
  Download,
  FileDown,
  Plus,
  ScanLine,
  Search,
  Ticket,
  Trash2,
  Undo2,
  UserCheck,
  UserPlus,
  Users,
} from "lucide-react";
import Link from "next/link";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Input } from "@/components/ui/field";
import { PageSpinner } from "@/components/ui/spinner";
import { Stat } from "@/components/ui/stat";
import { formatDay, formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";

type TicketRow = {
  id: string;
  code: string;
  number: number | null;
  createdAt: string;
  checkedIn: boolean;
  redeemedAt: string | null;
  participant: { name: string; email: string };
};

type ParticipantsResponse = {
  event: {
    id: string;
    name: string;
    date: string;
    location: string | null;
    maxTickets: number | null;
    show: boolean;
  };
  stats: { issued: number; checkedIn: number };
  tickets: TicketRow[];
};

type Filter = "all" | "present" | "absent";

const POLL_INTERVAL_MS = 15000;

/** Minuscules sans accents : « zoe » retrouve « Zoé », « lukasz » retrouve « Łukasz ». */
const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/ł/g, "l")
    .replace(/ø/g, "o")
    .replace(/đ/g, "d")
    .replace(/ß/g, "ss")
    .replace(/æ/g, "ae")
    .replace(/œ/g, "oe");

const initials = (name: string) =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

function ParticipantsContent() {
  const router = useRouter();
  const eventId = typeof router.query.id === "string" ? router.query.id : null;

  const [data, setData] = useState<ParticipantsResponse | null>(null);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [busyId, setBusyId] = useState<string | null>(null);

  const [showAdd, setShowAdd] = useState(false);
  const [addName, setAddName] = useState("");
  const [addEmail, setAddEmail] = useState("");
  const [addError, setAddError] = useState("");
  const [adding, setAdding] = useState(false);

  const [toCancel, setToCancel] = useState<TicketRow | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const load = useCallback(async () => {
    if (!eventId) return;
    try {
      const res = await fetch(`/api/admin/events/${eventId}/tickets`);
      if (res.status === 403) return setLoadError("Vous n’avez pas accès à cette séance.");
      if (res.status === 404) return setLoadError("Séance introuvable.");
      if (!res.ok) return setLoadError("Impossible de charger les réservations.");
      setData((await res.json()) as ParticipantsResponse);
      setLoadError("");
    } catch {
      setLoadError("Impossible de charger les réservations.");
    }
  }, [eventId]);

  useEffect(() => {
    if (!eventId) return;
    void load();
    // D'autres membres du bureau peuvent contrôler en même temps : on rafraîchit la liste.
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [eventId, load]);

  const filtered = useMemo(() => {
    if (!data) return [];
    const query = normalize(search.trim());
    return data.tickets.filter((ticket) => {
      if (filter === "present" && !ticket.checkedIn) return false;
      if (filter === "absent" && ticket.checkedIn) return false;
      if (!query) return true;
      return normalize(`${ticket.participant.name} ${ticket.participant.email} ${ticket.code}`).includes(query);
    });
  }, [data, search, filter]);

  const toggleCheckIn = async (ticket: TicketRow) => {
    setBusyId(ticket.id);
    setActionError("");
    try {
      const res = await fetch(`/api/admin/tickets/${ticket.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checkedIn: !ticket.checkedIn }),
      });
      if (!res.ok) setActionError("La validation n’a pas pu être modifiée. Réessayez.");
    } finally {
      setBusyId(null);
      await load();
    }
  };

  const confirmCancel = async () => {
    if (!toCancel) return;
    setCancelling(true);
    setActionError("");
    try {
      const res = await fetch(`/api/admin/tickets/${toCancel.id}`, { method: "DELETE" });
      if (!res.ok) setActionError("La réservation n’a pas pu être annulée. Réessayez.");
    } finally {
      setCancelling(false);
      setToCancel(null);
      await load();
    }
  };

  const addParticipant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventId) return;
    setAddError("");
    setAdding(true);
    try {
      const res = await fetch(`/api/admin/events/${eventId}/tickets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: addName, email: addEmail }),
      });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) {
        setAddError(body.error ?? "L’ajout a échoué. Réessayez.");
        return;
      }
      setAddName("");
      setAddEmail("");
      setShowAdd(false);
      await load();
    } catch {
      setAddError("Connexion impossible. Vérifiez votre réseau puis réessayez.");
    } finally {
      setAdding(false);
    }
  };

  if (loadError && !data) return <Alert tone="danger">{loadError}</Alert>;
  if (!data) return <PageSpinner label="Chargement des réservations" />;

  const { event, stats, tickets } = data;
  const present = stats.checkedIn;
  const absent = stats.issued - stats.checkedIn;
  const over = event.maxTickets ? stats.issued > event.maxTickets : false;

  const filters: { key: Filter; label: string; count: number }[] = [
    { key: "all", label: "Tous", count: stats.issued },
    { key: "present", label: "Présents", count: present },
    { key: "absent", label: "Absents", count: absent },
  ];

  return (
    <>
      <PageHeader
        back={{ href: "/admin/events", label: "Séances" }}
        title="Réservations"
        description={
          <>
            <span className="font-semibold text-ink">{event.name}</span> ·{" "}
            <span className="first-letter:uppercase">
              {formatDay(event.date)}, {formatTime(event.date)}
            </span>
            {event.location ? ` · ${event.location}` : ""}
          </>
        }
        actions={
          <>
            <Button asChild>
              <Link href={`/verify?event=${event.id}`}>
                <ScanLine aria-hidden />
                Contrôler
              </Link>
            </Button>
            <Button asChild variant="secondary">
              <a href={`/api/admin/events/${event.id}/tickets/export`} download>
                <FileDown aria-hidden />
                Exporter (CSV)
              </a>
            </Button>
          </>
        }
      />

      {!event.show && (
        <Alert tone="warning" className="mb-5">
          Cette séance est en brouillon : elle n’est pas visible du public.
        </Alert>
      )}
      {actionError && (
        <Alert tone="danger" className="mb-5">
          {actionError}
        </Alert>
      )}

      <div className="mb-6 grid grid-cols-3 gap-3 sm:gap-4">
        <Stat
          icon={Ticket}
          label={over ? "Réservations (capacité dépassée)" : "Réservations"}
          value={stats.issued}
          suffix={event.maxTickets ? `/ ${event.maxTickets}` : undefined}
        />
        <Stat icon={UserCheck} label="Présents" value={present} tone="success" />
        <Stat
          icon={Users}
          label="Places libres"
          value={event.maxTickets ? Math.max(0, event.maxTickets - stats.issued) : "∞"}
          tone="accent"
        />
      </div>

      <div className="mb-4 space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-subtle" aria-hidden />
          <Input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Nom, e-mail ou code"
            aria-label="Rechercher une réservation"
            className="pl-12"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div role="group" aria-label="Filtrer par présence" className="inline-flex rounded-xl bg-muted p-1">
            {filters.map((item) => (
              <button
                key={item.key}
                type="button"
                aria-pressed={filter === item.key}
                onClick={() => setFilter(item.key)}
                className={cn(
                  "h-9 rounded-lg px-3.5 text-sm font-semibold transition",
                  filter === item.key ? "bg-surface text-ink shadow-sm" : "text-subtle hover:text-ink",
                )}
              >
                {item.label} <span className="tabular opacity-70">{item.count}</span>
              </button>
            ))}
          </div>

          <Button variant={showAdd ? "soft" : "secondary"} size="sm" className="ml-auto" onClick={() => setShowAdd((value) => !value)}>
            <Plus aria-hidden />
            Ajouter une personne
          </Button>
        </div>
      </div>

      {showAdd && (
        <Card className="mb-4 p-4 sm:p-5">
          <form onSubmit={addParticipant} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nom" htmlFor="add-name">
                <Input id="add-name" value={addName} onChange={(e) => setAddName(e.target.value)} required maxLength={100} autoComplete="off" />
              </Field>
              <Field label="Adresse e-mail" htmlFor="add-email">
                <Input id="add-email" type="email" value={addEmail} onChange={(e) => setAddEmail(e.target.value)} required autoComplete="off" />
              </Field>
            </div>
            <p className="text-sm text-subtle">Pour une personne sans réservation. L’ajout reste possible quand la séance est complète.</p>
            {addError && <Alert tone="danger">{addError}</Alert>}
            <Button type="submit" loading={adding}>
              <UserPlus aria-hidden />
              Ajouter
            </Button>
          </form>
        </Card>
      )}

      {filtered.length === 0 ? (
        <EmptyState
          icon={tickets.length === 0 ? Ticket : Search}
          title={tickets.length === 0 ? "Aucune réservation pour le moment" : "Aucun résultat"}
          description={tickets.length === 0 ? "Les réservations apparaîtront ici dès que des étudiants auront réservé." : "Essayez un autre nom, e-mail ou code."}
        />
      ) : (
        <ul className="space-y-3">
          {filtered.map((ticket) => (
            <li key={ticket.id}>
              <Card className="p-3.5 sm:p-4">
                <div className="flex items-start gap-3.5">
                  <span
                    className={cn(
                      "inline-flex size-11 shrink-0 items-center justify-center rounded-full text-sm font-bold",
                      ticket.checkedIn ? "bg-success-soft text-success" : "bg-brand-soft text-brand-strong",
                    )}
                  >
                    {ticket.checkedIn ? <Check className="size-5" aria-hidden /> : initials(ticket.participant.name)}
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <p className="min-w-0 break-words font-semibold">
                        {ticket.participant.name}
                        {ticket.number !== null && <span className="ml-2 text-sm font-normal text-subtle">n°{ticket.number}</span>}
                      </p>
                      {ticket.checkedIn && ticket.redeemedAt ? (
                        <Badge tone="success">Présent à {formatTime(ticket.redeemedAt)}</Badge>
                      ) : (
                        <Badge tone="neutral">Absent</Badge>
                      )}
                    </div>
                    <p className="truncate text-sm text-subtle">{ticket.participant.email}</p>
                    <p className="mt-0.5 truncate font-mono text-xs text-subtle/80">{ticket.code}</p>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2 pl-0 sm:pl-[3.625rem]">
                  <Button
                    size="sm"
                    variant={ticket.checkedIn ? "secondary" : "primary"}
                    loading={busyId === ticket.id}
                    onClick={() => void toggleCheckIn(ticket)}
                  >
                    {ticket.checkedIn ? <Undo2 aria-hidden /> : <Check aria-hidden />}
                    {ticket.checkedIn ? "Annuler la validation" : "Valider à la main"}
                  </Button>
                  <Button asChild size="sm" variant="ghost">
                    <a href={`/api/tickets/${ticket.code}/pdf`} download>
                      <Download aria-hidden />
                      Billet
                    </a>
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="danger-soft"
                    className="ml-auto"
                    aria-label={`Annuler la réservation de ${ticket.participant.name}`}
                    title="Annuler la réservation"
                    onClick={() => setToCancel(ticket)}
                  >
                    <Trash2 aria-hidden />
                  </Button>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={toCancel !== null}
        onOpenChange={(open) => !open && setToCancel(null)}
        title={`Annuler la réservation de ${toCancel?.participant.name ?? ""} ?`}
        description="La place sera libérée et le QR code de ce billet ne sera plus valable. Cette personne pourra réserver à nouveau."
        confirmLabel="Annuler la réservation"
        cancelLabel="Conserver"
        loading={cancelling}
        onConfirm={confirmCancel}
      />
    </>
  );
}

export default function ParticipantsPage() {
  return (
    <AdminLayout title="Réservations">
      <ParticipantsContent />
    </AdminLayout>
  );
}
