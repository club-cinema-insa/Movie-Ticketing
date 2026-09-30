import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Alert } from "@/components/ui/alert";
import { EventForm, emptyEventForm, eventFormToPayload, type EventFormValues } from "@/components/admin/EventForm";
import { localDateTimeParts, nextSameWeekday } from "@/lib/eventTime";

type TemplateEvent = {
  name: string;
  date: string;
  location?: string | null;
  maxTickets?: number | null;
};

export default function NewEventPage() {
  const router = useRouter();
  const [values, setValues] = useState<EventFormValues>(emptyEventForm);
  const [template, setTemplate] = useState<TemplateEvent | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Les séances du club se répètent : seul le film change. On reprend la dernière séance.
  useEffect(() => {
    let cancelled = false;

    const loadDefaults = async () => {
      try {
        const res = await fetch("/api/admin/events");
        if (!res.ok) return;
        const events = (await res.json()) as TemplateEvent[];
        const latest = events.reduce<TemplateEvent | null>(
          (best, event) => (!best || new Date(event.date) > new Date(best.date) ? event : best),
          null,
        );
        if (!latest || cancelled) return;

        const parts = localDateTimeParts(latest.date);
        if (!parts) return;
        const suggested = localDateTimeParts(nextSameWeekday(new Date(latest.date)).toISOString());

        // On ne remplace que les champs que l'utilisateur n'a pas déjà remplis.
        const keep = (value: string, fallback: string) => (value === "" ? fallback : value);
        setValues((current) => ({
          ...current,
          date: keep(current.date, suggested?.date ?? ""),
          time: keep(current.time, parts.time),
          location: keep(current.location, latest.location ?? ""),
          maxTickets: keep(current.maxTickets, latest.maxTickets ? String(latest.maxTickets) : ""),
        }));
        setTemplate(latest);
      } catch {
        // Le préremplissage est facultatif.
      }
    };

    void loadDefaults();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubmit = async () => {
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/admin/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(eventFormToPayload(values)),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "La séance n’a pas pu être créée. Réessayez.");
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
    <AdminLayout title="Nouvelle séance">
      <div className="mx-auto max-w-2xl">
        <PageHeader
          back={{ href: "/admin/events", label: "Séances" }}
          title="Nouvelle séance"
          description="Renseignez le film : le reste est repris de la dernière séance."
        />

        <EventForm
          values={values}
          onChange={(patch) => setValues((current) => ({ ...current, ...patch }))}
          onSubmit={handleSubmit}
          submitting={submitting}
          submitLabel="Créer la séance"
          error={error}
          showPublishSwitch
          cancelHref="/admin/events"
          notice={
            template && (
              <Alert tone="info">
                Date, heure, lieu et nombre de places sont préremplis d’après la dernière séance (« {template.name} »).
              </Alert>
            )
          }
        />
      </div>
    </AdminLayout>
  );
}
