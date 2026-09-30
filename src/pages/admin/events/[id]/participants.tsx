import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { useSession, signIn } from "next-auth/react";

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
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/ł/g, "l")
    .replace(/ø/g, "o")
    .replace(/đ/g, "d")
    .replace(/ß/g, "ss")
    .replace(/æ/g, "ae")
    .replace(/œ/g, "oe");

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

export default function ParticipantsPage() {
  const router = useRouter();
  const eventId = typeof router.query.id === "string" ? router.query.id : null;
  const { data: session, status } = useSession();

  const [data, setData] = useState<ParticipantsResponse | null>(null);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [busyId, setBusyId] = useState<string | null>(null);

  const [showAdd, setShowAdd] = useState(false);
  const [addName, setAddName] = useState("");
  const [addEmail, setAddEmail] = useState("");
  const [addError, setAddError] = useState("");
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    if (!eventId) return;
    try {
      const res = await fetch(`/api/admin/events/${eventId}/tickets`);
      if (res.status === 403) {
        setError("Vous n’avez pas accès à cette projection.");
        return;
      }
      if (res.status === 404) {
        setError("Projection introuvable.");
        return;
      }
      if (!res.ok) {
        setError("Impossible de charger les inscrits.");
        return;
      }
      setData((await res.json()) as ParticipantsResponse);
      setError("");
    } catch {
      setError("Impossible de charger les inscrits.");
    }
  }, [eventId]);

  useEffect(() => {
    if (status !== "authenticated" || !eventId) return;
    void load();
    // D'autres membres du bureau peuvent scanner en même temps : on rafraîchit la liste.
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [status, eventId, load]);

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
    try {
      const res = await fetch(`/api/admin/tickets/${ticket.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checkedIn: !ticket.checkedIn }),
      });
      if (!res.ok) alert("La validation n’a pas pu être modifiée.");
    } finally {
      setBusyId(null);
      await load();
    }
  };

  const cancelTicket = async (ticket: TicketRow) => {
    const label = `${ticket.participant.name} (${ticket.participant.email})`;
    if (!confirm(`Annuler la réservation de ${label} ?\nSa place sera libérée et son QR code ne sera plus valable.`)) return;

    setBusyId(ticket.id);
    try {
      const res = await fetch(`/api/admin/tickets/${ticket.id}`, { method: "DELETE" });
      if (!res.ok) alert("La réservation n’a pas pu être annulée.");
    } finally {
      setBusyId(null);
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
        setAddError(body.error ?? "Erreur lors de l’ajout.");
        return;
      }
      setAddName("");
      setAddEmail("");
      setShowAdd(false);
      await load();
    } finally {
      setAdding(false);
    }
  };

  if (status === "loading") return <p className="mt-10 text-center">Chargement...</p>;

  if (!session)
    return (
      <div className="mt-20 text-center">
        <h1 className="mb-4 text-2xl font-semibold">🔒 Accès restreint</h1>
        <button
          onClick={() => signIn("discord")}
          className="rounded bg-[var(--brand-primary)] px-4 py-2 text-white hover:bg-[var(--brand-secondary)]"
        >
          Se connecter avec Discord
        </button>
      </div>
    );

  if (error && !data)
    return (
      <div className="mx-auto mt-20 max-w-md px-4 text-center">
        <p className="mb-4 text-red-600">{error}</p>
        <Link href="/admin/events" className="text-sm text-slate-600 underline">
          ← Retour aux événements
        </Link>
      </div>
    );

  if (!data) return <p className="mt-10 text-center">Chargement...</p>;

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
    <div className="mx-auto w-full max-w-3xl px-4 pb-16 pt-6">
      <Link href="/admin/events" className="text-sm text-slate-500 hover:text-slate-800">
        ← Espace admin
      </Link>

      <header className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Inscrits — {event.name}</h1>
          <p className="text-sm text-slate-500">
            {new Date(event.date).toLocaleString("fr-FR", { dateStyle: "full", timeStyle: "short" })}
            {event.location ? ` · ${event.location}` : ""}
          </p>
          {!event.show && (
            <p className="mt-1 inline-block rounded bg-amber-50 px-2 py-0.5 text-xs text-amber-700">
              Projection masquée (non publiée)
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/verify?event=${event.id}`}
            className="rounded bg-[var(--brand-primary)] px-3 py-2 text-sm text-white hover:bg-[var(--brand-secondary)]"
          >
            Contrôler
          </Link>
          <a
            href={`/api/admin/events/${event.id}/tickets/export`}
            download
            className="rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            Exporter en CSV
          </a>
        </div>
      </header>

      {/* Chiffres clés */}
      <section className="mt-4 grid grid-cols-3 gap-3">
        <div className="rounded-xl bg-white p-3 text-center shadow-sm">
          <p className="text-2xl font-extrabold text-slate-800">
            {stats.issued}
            {event.maxTickets ? <span className="text-base font-semibold text-slate-400"> / {event.maxTickets}</span> : null}
          </p>
          <p className="text-xs text-slate-500">inscrits{over ? " (capacité dépassée)" : ""}</p>
        </div>
        <div className="rounded-xl bg-white p-3 text-center shadow-sm">
          <p className="text-2xl font-extrabold text-green-600">{present}</p>
          <p className="text-xs text-slate-500">présents</p>
        </div>
        <div className="rounded-xl bg-white p-3 text-center shadow-sm">
          <p className="text-2xl font-extrabold text-slate-700">
            {event.maxTickets ? Math.max(0, event.maxTickets - stats.issued) : "∞"}
          </p>
          <p className="text-xs text-slate-500">places libres</p>
        </div>
      </section>

      {/* Recherche et filtres */}
      <section className="mt-4 space-y-3">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Nom, email ou code"
          className="w-full rounded-lg border bg-white px-3 py-2 text-sm shadow-sm"
        />
        <div className="flex flex-wrap items-center gap-2">
          {filters.map((item) => (
            <button
              key={item.key}
              onClick={() => setFilter(item.key)}
              className={`rounded-full px-3 py-1 text-sm ${
                filter === item.key ? "bg-slate-800 text-white" : "bg-white text-slate-600 shadow-sm hover:bg-slate-50"
              }`}
            >
              {item.label} ({item.count})
            </button>
          ))}
          <button
            onClick={() => setShowAdd((value) => !value)}
            className="ml-auto rounded-full border border-slate-300 bg-white px-3 py-1 text-sm text-slate-700 hover:bg-slate-50"
          >
            {showAdd ? "Fermer" : "+ Ajouter un participant"}
          </button>
        </div>
      </section>

      {showAdd && (
        <form onSubmit={addParticipant} className="mt-3 space-y-3 rounded-xl border bg-white p-4 shadow-sm">
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              value={addName}
              onChange={(e) => setAddName(e.target.value)}
              placeholder="Nom complet"
              required
              maxLength={100}
              className="rounded border px-3 py-2 text-sm"
            />
            <input
              type="email"
              value={addEmail}
              onChange={(e) => setAddEmail(e.target.value)}
              placeholder="Adresse email"
              required
              className="rounded border px-3 py-2 text-sm"
            />
          </div>
          <p className="text-xs text-slate-500">
            Pour une personne sans réservation. L’ajout est possible même si la projection est complète.
          </p>
          {addError && <p className="text-sm text-red-600">{addError}</p>}
          <button
            type="submit"
            disabled={adding}
            className="rounded bg-[var(--brand-primary)] px-4 py-2 text-sm text-white hover:bg-[var(--brand-secondary)] disabled:opacity-50"
          >
            {adding ? "Ajout…" : "Ajouter"}
          </button>
        </form>
      )}

      {/* Liste */}
      <ul className="mt-4 space-y-2">
        {filtered.map((ticket) => (
          <li key={ticket.id} className="rounded-xl border bg-white p-3 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-semibold text-slate-800">
                  <span className="mr-2 text-sm font-normal text-slate-400">#{ticket.number ?? "—"}</span>
                  {ticket.participant.name}
                </p>
                <p className="truncate text-sm text-slate-500">{ticket.participant.email}</p>
                <p className="mt-0.5 font-mono text-xs text-slate-400">
                  {ticket.code} · inscrit le {formatDateTime(ticket.createdAt)}
                </p>
              </div>
              <span
                className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
                  ticket.checkedIn ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"
                }`}
              >
                {ticket.checkedIn && ticket.redeemedAt ? `Présent ${formatTime(ticket.redeemedAt)}` : "Absent"}
              </span>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                onClick={() => void toggleCheckIn(ticket)}
                disabled={busyId === ticket.id}
                className={`rounded px-3 py-1 text-sm text-white disabled:opacity-50 ${
                  ticket.checkedIn ? "bg-slate-500 hover:bg-slate-600" : "bg-green-600 hover:bg-green-700"
                }`}
              >
                {ticket.checkedIn ? "Annuler la validation" : "Valider à la main"}
              </button>
              <a
                href={`/api/tickets/${ticket.code}/pdf`}
                download
                className="rounded border border-slate-300 px-3 py-1 text-sm text-slate-700 hover:bg-slate-50"
              >
                Billet PDF
              </a>
              <button
                onClick={() => void cancelTicket(ticket)}
                disabled={busyId === ticket.id}
                className="ml-auto rounded bg-red-600 px-3 py-1 text-sm text-white hover:bg-red-700 disabled:opacity-50"
              >
                Annuler la réservation
              </button>
            </div>
          </li>
        ))}
        {filtered.length === 0 && (
          <li className="rounded-xl border border-dashed bg-white p-6 text-center text-sm text-slate-500">
            {tickets.length === 0 ? "Aucune inscription pour le moment." : "Aucun résultat pour cette recherche."}
          </li>
        )}
      </ul>
    </div>
  );
}
