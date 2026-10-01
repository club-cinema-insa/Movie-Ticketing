import { useState } from "react";
import Link from "next/link";
import { Clapperboard } from "lucide-react";
import { branding } from "@/config/branding";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { addMinutesToTime, minutesBetween, toOffsetIso } from "@/lib/eventTime";

export type EventFormValues = {
  name: string;
  date: string;
  /** Ouverture des portes (« HH:mm »). */
  time: string;
  /** Début de la projection (« HH:mm »), seulement si le club distingue portes et début. */
  startTime: string;
  location: string;
  description: string;
  image: string;
  maxTickets: string;
  show: boolean;
};

export const emptyEventForm: EventFormValues = {
  name: "",
  date: "",
  time: "",
  startTime: "",
  location: "",
  description: "",
  image: "",
  maxTickets: "",
  show: false,
};

type Errors = Partial<Record<keyof EventFormValues, string>>;

export function validateEventForm(values: EventFormValues): Errors {
  const errors: Errors = {};
  if (!values.name.trim()) errors.name = "Indiquez le nom du film.";
  if (!values.date) errors.date = "Choisissez une date.";
  if (!values.time) errors.time = "Indiquez l’heure.";
  if (values.date && values.time && !toOffsetIso(values.date, values.time)) errors.date = "Date ou heure invalide.";
  if (branding.startsAfterDoorsMinutes && values.time) {
    if (!values.startTime) errors.startTime = "Indiquez l’heure de début.";
    else if ((minutesBetween(values.time, values.startTime) ?? 0) < 0) {
      errors.startTime = "Le début doit être après l’ouverture des portes.";
    }
  }
  if (values.maxTickets) {
    const max = Number(values.maxTickets);
    if (!Number.isInteger(max) || max < 1) errors.maxTickets = "Saisissez un nombre entier supérieur à 0, ou laissez vide.";
  }
  if (values.image && !/^https?:\/\//i.test(values.image.trim())) errors.image = "Saisissez une adresse commençant par https://";
  return errors;
}

/** Corps JSON attendu par l'API des séances (`show` est omis à la modification : il se règle depuis la liste). */
export function eventFormToPayload(values: EventFormValues, options: { includeShow?: boolean } = {}) {
  const { includeShow = true } = options;
  return {
    name: values.name.trim(),
    date: toOffsetIso(values.date, values.time),
    location: values.location.trim(),
    description: values.description.trim(),
    image: values.image.trim(),
    maxTickets: values.maxTickets ? parseInt(values.maxTickets, 10) : null,
    ...(branding.startsAfterDoorsMinutes && values.startTime
      ? { startOffsetMinutes: minutesBetween(values.time, values.startTime) }
      : {}),
    ...(includeShow ? { show: values.show } : {}),
  };
}

/** Formulaire de projection, partagé entre la création et la modification. */
export function EventForm({
  values,
  onChange,
  onSubmit,
  submitting,
  submitLabel,
  error,
  notice,
  showPublishSwitch = false,
  cancelHref,
}: {
  values: EventFormValues;
  onChange: (patch: Partial<EventFormValues>) => void;
  onSubmit: () => void | Promise<void>;
  submitting: boolean;
  submitLabel: string;
  error?: string;
  notice?: React.ReactNode;
  showPublishSwitch?: boolean;
  cancelHref: string;
}) {
  const [errors, setErrors] = useState<Errors>({});
  const [previewFailed, setPreviewFailed] = useState(false);

  const doorsMinutes = branding.startsAfterDoorsMinutes;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const found = validateEventForm(values);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      const first = Object.keys(found)[0];
      document.getElementById(`field-${first}`)?.focus();
      return;
    }
    void onSubmit();
  };

  const set = (patch: Partial<EventFormValues>) => {
    // Changer l'ouverture des portes décale le début de la même durée (le délai choisi est conservé).
    if (doorsMinutes && patch.time !== undefined && patch.startTime === undefined) {
      const gap = minutesBetween(values.time, values.startTime) ?? doorsMinutes;
      const shifted = addMinutesToTime(patch.time, gap);
      if (shifted) patch = { ...patch, startTime: shifted };
    }
    onChange(patch);
    if (patch.image !== undefined) setPreviewFailed(false);
    setErrors((current) => {
      const next = { ...current };
      for (const key of Object.keys(patch)) delete next[key as keyof EventFormValues];
      return next;
    });
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      {notice}

      <Card className="space-y-5 p-5 sm:p-6">
        <h2 className="text-lg font-bold">Le film</h2>

        <Field label="Nom du film" htmlFor="field-name" error={errors.name}>
          <Input
            id="field-name"
            value={values.name}
            onChange={(e) => set({ name: e.target.value })}
            aria-invalid={Boolean(errors.name)}
            placeholder="Alien, le huitième passager"
            autoComplete="off"
          />
        </Field>

        <Field
          label="Affiche"
          htmlFor="field-image"
          error={errors.image}
          optional
          hint="Adresse d’une image PNG ou JPEG. Elle s’affiche sur le site et sur le billet."
        >
          <Input
            id="field-image"
            type="url"
            inputMode="url"
            value={values.image}
            onChange={(e) => set({ image: e.target.value })}
            aria-invalid={Boolean(errors.image)}
            placeholder="https://…"
            autoComplete="off"
          />
        </Field>

        {values.image && !errors.image && (
          <div className="overflow-hidden rounded-xl border border-line bg-brand-strong">
            {previewFailed ? (
              <div className="flex aspect-[16/7] flex-col items-center justify-center gap-2 px-4 text-center text-sm text-white/80">
                <Clapperboard className="size-8" aria-hidden />
                Impossible de charger cette image. Vérifiez l’adresse.
              </div>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={values.image}
                alt="Aperçu de l’affiche"
                className="aspect-[16/8] w-full object-cover"
                onError={() => setPreviewFailed(true)}
              />
            )}
          </div>
        )}
      </Card>

      <Card className="space-y-5 p-5 sm:p-6">
        <h2 className="text-lg font-bold">Date et lieu</h2>

        <div className={`grid gap-5 ${doorsMinutes ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
          <Field label="Date" htmlFor="field-date" error={errors.date}>
            <Input
              id="field-date"
              type="date"
              value={values.date}
              onChange={(e) => set({ date: e.target.value })}
              aria-invalid={Boolean(errors.date)}
            />
          </Field>

          <Field label={doorsMinutes ? "Ouverture des portes" : "Heure"} htmlFor="field-time" error={errors.time}>
            <Input
              id="field-time"
              type="time"
              value={values.time}
              onChange={(e) => set({ time: e.target.value })}
              aria-invalid={Boolean(errors.time)}
            />
          </Field>

          {doorsMinutes ? (
            <Field label={branding.startLabel ?? "Début"} htmlFor="field-startTime" error={errors.startTime}>
              <Input
                id="field-startTime"
                type="time"
                value={values.startTime}
                onChange={(e) => set({ startTime: e.target.value })}
                aria-invalid={Boolean(errors.startTime)}
              />
            </Field>
          ) : null}
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Lieu" htmlFor="field-location" optional>
            <Input
              id="field-location"
              value={values.location}
              onChange={(e) => set({ location: e.target.value })}
              placeholder="À la Tek"
              autoComplete="off"
            />
          </Field>

          <Field
            label="Nombre de places"
            htmlFor="field-maxTickets"
            error={errors.maxTickets}
            optional
            hint="Laissez vide pour ne pas limiter les réservations."
          >
            <Input
              id="field-maxTickets"
              type="number"
              inputMode="numeric"
              min={1}
              value={values.maxTickets}
              onChange={(e) => set({ maxTickets: e.target.value })}
              aria-invalid={Boolean(errors.maxTickets)}
              placeholder="40"
            />
          </Field>
        </div>
      </Card>

      <Card className="space-y-5 p-5 sm:p-6">
        <h2 className="text-lg font-bold">Présentation</h2>
        <Field
          label="Description"
          htmlFor="field-description"
          optional
          hint="Synopsis, informations pratiques… Le texte s’affiche sur la page de réservation."
        >
          <Textarea
            id="field-description"
            value={values.description}
            onChange={(e) => set({ description: e.target.value })}
            rows={5}
          />
        </Field>

        {showPublishSwitch && (
          <Switch
            id="field-show"
            checked={values.show}
            onCheckedChange={(show) => set({ show })}
            label="Publier tout de suite"
            hint="Sinon la séance reste en brouillon, invisible du public, jusqu’à sa publication."
          />
        )}
      </Card>

      {error && <Alert tone="danger">{error}</Alert>}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button asChild variant="secondary" size="lg">
          <Link href={cancelHref}>Annuler</Link>
        </Button>
        <Button type="submit" size="lg" loading={submitting}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
