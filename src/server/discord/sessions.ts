import type { Event } from "@prisma/client";
import { env } from "@/env";
import { db } from "@/server/db";
import { eventStartDate } from "@/lib/format";
import { siteUrl } from "@/server/utils/siteUrl";
import { hostedPosterId, loadHostedPoster } from "@/server/posters/store";
import {
  createScheduledEvent,
  deleteScheduledEvent,
  discordConfigured,
  postMessage,
  scheduledEventUrl,
  updateScheduledEvent,
  type ScheduledEventPayload,
} from "@/server/discord/client";
import { buildAnnouncement, buildEventDescription, buildFullAlert } from "@/server/discord/message";

/** Durée supposée quand elle n'est pas renseignée : Discord exige une heure de fin pour un événement hors salon. */
const DEFAULT_SESSION_DURATION_MS = 3 * 3_600_000;
/** Marge après le film (générique, discussions) quand sa durée est connue. */
const AFTER_FILM_MARGIN_MS = 30 * 60_000;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const IMAGE_TIMEOUT_MS = 5000;

const logFailure = (action: string, error: unknown) =>
  console.error(`Discord : ${action} impossible (la séance n'est pas affectée) :`, error instanceof Error ? error.message : error);

const bookingUrl = (eventId: string) => {
  const base = siteUrl();
  return base ? `${base}/events/${eventId}/register` : null;
};

/** Affiche → data URL pour la couverture de la séance Discord ; null si elle est absente ou inutilisable. */
async function coverImage(url: string | null): Promise<string | null> {
  if (hostedPosterId(url)) {
    const hosted = await loadHostedPoster(url!);
    return hosted && hosted.data.length <= MAX_IMAGE_BYTES ? `data:${hosted.contentType};base64,${hosted.data.toString("base64")}` : null;
  }
  if (!url || !/^https?:\/\//i.test(url)) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(IMAGE_TIMEOUT_MS) });
    const type = res.headers.get("content-type")?.split(";")[0]?.trim() ?? "";
    if (!res.ok || !/^image\/(png|jpeg|gif)$/.test(type)) return null;
    const data = Buffer.from(await res.arrayBuffer());
    return data.length <= MAX_IMAGE_BYTES ? `data:${type};base64,${data.toString("base64")}` : null;
  } catch {
    return null;
  }
}

function eventPayload(event: Event): Omit<ScheduledEventPayload, "image"> {
  const start = eventStartDate(event.date, event.startOffsetMinutes);
  return {
    name: event.name.slice(0, 100),
    description: buildEventDescription(event, bookingUrl(event.id)),
    scheduled_start_time: start.toISOString(),
    scheduled_end_time: new Date(
      start.getTime() + (event.runtimeMinutes ? event.runtimeMinutes * 60_000 + AFTER_FILM_MARGIN_MS : DEFAULT_SESSION_DURATION_MS),
    ).toISOString(),
    location: (event.location ?? "Lieu à préciser").slice(0, 100),
  };
}

/**
 * Annonce une séance publiée : crée la séance Discord (affiche, date, lieu), puis poste
 * l'annonce avec son lien dans le salon des annonces. Une seule fois par séance.
 * Ne lève jamais d'exception : une panne de Discord ne doit pas gêner le bureau.
 */
export async function announceSession(eventId: string): Promise<void> {
  if (!discordConfigured()) return;

  const event = await db.event.findUnique({ where: { id: eventId } });
  if (!event || !event.show || event.announcedAt) return;
  // Discord refuse une séance dans le passé, et une annonce n'aurait plus de sens.
  if (eventStartDate(event.date, event.startOffsetMinutes) <= new Date()) return;

  // Réservation de l'annonce : deux publications simultanées n'envoient qu'un message.
  const claimed = await db.event.updateMany({ where: { id: eventId, announcedAt: null }, data: { announcedAt: new Date() } });
  if (claimed.count === 0) return;

  let discordEventUrl: string | null = null;
  try {
    const image = await coverImage(event.image);
    const discordEventId = await createScheduledEvent({ ...eventPayload(event), ...(image ? { image } : {}) });
    await db.event.update({ where: { id: eventId }, data: { discordEventId } });
    discordEventUrl = scheduledEventUrl(discordEventId);
  } catch (error) {
    logFailure("création de la séance Discord", error);
  }

  const channelId = env.DISCORD_ANNOUNCE_CHANNEL_ID;
  if (!channelId) return;
  try {
    await postMessage(channelId, buildAnnouncement(event, { bookingUrl: bookingUrl(event.id), discordEventUrl }), true);
  } catch (error) {
    logFailure("annonce", error);
    // Rien n'a été annoncé : une prochaine publication pourra réessayer.
    await db.event.updateMany({ where: { id: eventId }, data: { announcedAt: null } }).catch(() => undefined);
  }
}

/** Répercute une modification de la séance (nom, date, lieu, description) sur sa séance Discord. */
export async function syncSession(eventId: string): Promise<void> {
  if (!discordConfigured()) return;
  try {
    const event = await db.event.findUnique({ where: { id: eventId } });
    if (!event?.discordEventId) return;
    await updateScheduledEvent(event.discordEventId, eventPayload(event));
  } catch (error) {
    logFailure("mise à jour de la séance Discord", error);
  }
}

/** Supprime la séance Discord d'une séance supprimée du site. */
export async function removeSession(discordEventId: string): Promise<void> {
  if (!discordConfigured()) return;
  try {
    await deleteScheduledEvent(discordEventId);
  } catch (error) {
    logFailure("suppression de la séance Discord", error);
  }
}

/** Prévient le salon du bureau quand le dernier billet vient d'être pris. */
export async function notifyIfFull(event: Pick<Event, "id" | "name" | "maxTickets">): Promise<void> {
  const channelId = env.DISCORD_STAFF_CHANNEL_ID;
  if (!discordConfigured() || !channelId || !event.maxTickets) return;
  try {
    const issued = await db.ticket.count({ where: { eventId: event.id } });
    if (issued !== event.maxTickets) return;
    await postMessage(channelId, buildFullAlert(event, bookingUrl(event.id)));
  } catch (error) {
    logFailure("alerte séance complète", error);
  }
}
