import { useRef, useState } from "react";
import Link from "next/link";
import { Clapperboard, ImageUp, X } from "lucide-react";
import { branding } from "@/config/branding";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { addMinutesToTime, minutesBetween, toOffsetIso } from "@/lib/eventTime";
import { MAX_SOURCE_BYTES, prepareImageForUpload } from "@/lib/image";
import { FilmSearch, type ImportedFilm } from "@/components/admin/FilmSearch";

export type EventFormValues = {
  name: string;
  date: string;
  /** Ouverture des portes (« HH:mm »). */
  time: string;
  /** Début de la projection (« HH:mm »), seulement si le club distingue portes et début. */
  startTime: string;
  location: string;
  description: string;
  announceEmojis: string;
  director: string;
  /** Durée en minutes (texte du champ). */
  runtimeMinutes: string;
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
  announceEmojis: "",
  director: "",
  runtimeMinutes: "",
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
  if (values.runtimeMinutes) {
    const minutes = Number(values.runtimeMinutes);
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > 600) errors.runtimeMinutes = "Saisissez une durée en minutes (entre 1 et 600), ou laissez vide.";
  }
  if (values.maxTickets) {
    const max = Number(values.maxTickets);
    if (!Number.isInteger(max) || max < 1) errors.maxTickets = "Saisissez un nombre entier supérieur à 0, ou laissez vide.";
  }
  if (values.image && !/^https?:\/\//i.test(values.image.trim()) && !values.image.startsWith("/api/posters/")) {
    errors.image = "Envoyez une image ou saisissez une adresse commençant par https://";
  }
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
    announceEmojis: values.announceEmojis.trim(),
    director: values.director.trim(),
    runtimeMinutes: values.runtimeMinutes ? parseInt(values.runtimeMinutes, 10) : null,
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
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

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

  /** Réduit l'image choisie, l'envoie au site et remplit le champ « Affiche » avec son adresse. */
  const uploadPoster = async (file: File) => {
    setUploadError("");
    if (file.size > MAX_SOURCE_BYTES) {
      setUploadError("Ce fichier est trop volumineux (20 Mo maximum).");
      return;
    }
    setUploading(true);
    try {
      const blob = await prepareImageForUpload(file);
      const res = await fetch("/api/admin/posters", { method: "POST", headers: { "Content-Type": blob.type }, body: blob });
      const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        setUploadError(data.error ?? "L’envoi a échoué. Réessayez.");
        return;
      }
      set({ image: data.url });
    } catch {
      setUploadError("Cette image n’a pas pu être lue. Essayez un fichier JPEG ou PNG.");
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  /** Reprend les informations d'un film choisi dans la recherche (les champs restent modifiables). */
  const importFilm = (film: ImportedFilm) => {
    set({
      name: film.title || values.name,
      description: film.overview || values.description,
      director: film.director ?? values.director,
      runtimeMinutes: film.runtimeMinutes ? String(film.runtimeMinutes) : values.runtimeMinutes,
      image: film.image ?? values.image,
    });
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      {notice}

      <Card className="space-y-5 p-5 sm:p-6">
        <h2 className="text-lg font-bold">Le film</h2>

        <FilmSearch onImport={importFilm} />

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

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Réalisateur" htmlFor="field-director" optional>
            <Input
              id="field-director"
              value={values.director}
              onChange={(e) => set({ director: e.target.value })}
              placeholder="Ridley Scott"
              autoComplete="off"
            />
          </Field>
          <Field label="Durée (minutes)" htmlFor="field-runtimeMinutes" error={errors.runtimeMinutes} optional>
            <Input
              id="field-runtimeMinutes"
              type="number"
              inputMode="numeric"
              min={1}
              value={values.runtimeMinutes}
              onChange={(e) => set({ runtimeMinutes: e.target.value })}
              aria-invalid={Boolean(errors.runtimeMinutes)}
              placeholder="117"
            />
          </Field>
        </div>

        <Field
          label="Affiche"
          htmlFor="field-image"
          error={errors.image}
          optional
          hint="Elle s’affiche sur le site, sur le billet et dans la séance Discord. Envoyez une image ou collez son adresse."
        >
          <div className="space-y-2.5">
            <div className="flex flex-wrap gap-2">
              <input
                ref={fileInput}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="sr-only"
                tabIndex={-1}
                aria-label="Choisir une image d’affiche"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void uploadPoster(file);
                }}
              />
              <Button type="button" variant="secondary" loading={uploading} onClick={() => fileInput.current?.click()}>
                {!uploading && <ImageUp aria-hidden />}
                {uploading ? "Envoi en cours" : values.image ? "Remplacer l’image" : "Envoyer une image"}
              </Button>
              {values.image && (
                <Button type="button" variant="ghost" onClick={() => set({ image: "" })}>
                  <X aria-hidden />
                  Retirer
                </Button>
              )}
            </div>
            {uploadError && <Alert tone="danger">{uploadError}</Alert>}
            <Input
              id="field-image"
              inputMode="url"
              value={values.image.startsWith("/api/posters/") ? "Image envoyée depuis le formulaire" : values.image}
              readOnly={values.image.startsWith("/api/posters/")}
              onChange={(e) => set({ image: e.target.value })}
              aria-invalid={Boolean(errors.image)}
              placeholder="ou coller une adresse : https://…"
              autoComplete="off"
            />
          </div>
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

        <Field
          label="Emojis de l’annonce Discord"
          htmlFor="field-announceEmojis"
          optional
          hint="Quelques emojis qui évoquent le film, ajoutés à la fin de l’annonce. Sans choix : claquette et pop-corn."
        >
          <Input
            id="field-announceEmojis"
            value={values.announceEmojis}
            onChange={(e) => set({ announceEmojis: e.target.value })}
            maxLength={40}
            autoComplete="off"
            placeholder=":european_castle::sparkles:"
          />
        </Field>

        {showPublishSwitch && (
          <Switch
            id="field-show"
            checked={values.show}
            onCheckedChange={(show) => set({ show })}
            label="Publier tout de suite"
            hint="Sinon la séance reste en brouillon, invisible du public, jusqu’à sa publication. La publication déclenche l’annonce sur Discord quand elle est configurée."
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
