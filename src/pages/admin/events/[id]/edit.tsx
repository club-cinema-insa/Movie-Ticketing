import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { Users } from "lucide-react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { PageSpinner } from "@/components/ui/spinner";
import { EventForm, emptyEventForm, eventFormToPayload, type EventFormValues } from "@/components/admin/EventForm";
import { branding } from "@/config/branding";
import { addMinutesToTime, localDateTimeParts } from "@/lib/eventTime";

type EventResponse = {
  id: string;
  name: string;
  date: string;
  location: string | null;
  description: string | null;
  announceEmojis: string | null;
  director: string | null;
  runtimeMinutes: number | null;
  image: string | null;
  maxTickets: number | null;
  startOffsetMinutes: number | null;
  show: boolean;
  totalTickets?: number;
  checkedInCount?: number;
};

export default function EditEventPage() {
  const router = useRouter();
  const id = typeof router.query.id === "string" ? router.query.id : null;

  const [values, setValues] = useState<EventFormValues>(emptyEventForm);
  const [name, setName] = useState("");
  const [stats, setStats] = useState({ issued: 0, checkedIn: 0 });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!router.isReady || !id) return;

    const load = async () => {
      try {
        const res = await fetch(`/api/admin/events/${id}`);
        if (!res.ok) {
          setLoadError(res.status === 403 ? "Vous n’avez pas accès à cette séance." : "Séance introuvable.");
          return;
        }
        const data = (await res.json()) as EventResponse;
        const parts = localDateTimeParts(data.date);
        setName(data.name);
        setValues({
          name: data.name,
          date: parts?.date ?? "",
          time: parts?.time ?? "",
          startTime:
            parts && branding.startsAfterDoorsMinutes
              ? (addMinutesToTime(parts.time, data.startOffsetMinutes ?? branding.startsAfterDoorsMinutes) ?? "")
              : "",
          location: data.location ?? "",
          description: data.description ?? "",
          announceEmojis: data.announceEmojis ?? "",
          director: data.director ?? "",
          runtimeMinutes: data.runtimeMinutes ? String(data.runtimeMinutes) : "",
          image: data.image ?? "",
          maxTickets: data.maxTickets ? String(data.maxTickets) : "",
          show: data.show,
        });
        setStats({ issued: data.totalTickets ?? 0, checkedIn: data.checkedInCount ?? 0 });
      } catch {
        setLoadError("Impossible de charger la séance.");
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [router.isReady, id]);

  const handleSubmit = async () => {
    if (!id) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/events/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(eventFormToPayload(values, { includeShow: false })),
      });
      if (!res.ok) {
        setError("Les modifications n’ont pas pu être enregistrées. Réessayez.");
        return;
      }
      await router.push("/admin/events");
    } catch {
      setError("Connexion impossible. Vérifiez votre réseau puis réessayez.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AdminLayout title="Modifier la séance">
      <div className="mx-auto max-w-2xl">
        <PageHeader
          back={{ href: "/admin/events", label: "Séances" }}
          title="Modifier la séance"
          description={name || undefined}
        />

        {loading ? (
          <PageSpinner />
        ) : loadError ? (
          <Alert tone="danger">{loadError}</Alert>
        ) : (
          <EventForm
            values={values}
            onChange={(patch) => setValues((current) => ({ ...current, ...patch }))}
            onSubmit={handleSubmit}
            submitting={submitting}
            submitLabel="Enregistrer"
            error={error}
            cancelHref="/admin/events"
            notice={
              <Alert tone="info">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span>
                    {stats.issued} réservation{stats.issued > 1 ? "s" : ""}, dont {stats.checkedIn} billet
                    {stats.checkedIn > 1 ? "s" : ""} déjà contrôlé{stats.checkedIn > 1 ? "s" : ""}.
                  </span>
                  <Button asChild variant="soft" size="sm">
                    <Link href={`/admin/events/${id}/participants`}>
                      <Users aria-hidden />
                      Voir les réservations
                    </Link>
                  </Button>
                </div>
              </Alert>
            }
          />
        )}
      </div>
    </AdminLayout>
  );
}
