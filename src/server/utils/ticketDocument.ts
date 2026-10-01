import type { Event, Participant, Ticket } from "@prisma/client";
import { branding } from "@/config/branding";
import { generateTicketPDF } from "@/server/utils/generateTicketPDF";

const EVENT_TIME_ZONE = process.env.EVENT_TIME_ZONE ?? "Europe/Paris";

export const formatDate = (date: Date) =>
  date.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: EVENT_TIME_ZONE,
  });

/** « 19h45 », « 20h » : format français, sans « :00 » superflu. */
export const formatTime = (date: Date) => {
  const parts = new Intl.DateTimeFormat("fr-FR", {
    hour: "numeric",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: EVENT_TIME_ZONE,
  }).formatToParts(date);
  const hour = parts.find((part) => part.type === "hour")?.value ?? "";
  const minute = parts.find((part) => part.type === "minute")?.value ?? "00";
  return minute === "00" ? `${hour}h` : `${hour}h${minute}`;
};

/** Heure de début de la séance, si le club distingue ouverture des portes et début. */
export const startAfterDoors = (event: Pick<Event, "date" | "startOffsetMinutes">) => {
  const minutes = branding.startsAfterDoorsMinutes ? (event.startOffsetMinutes ?? branding.startsAfterDoorsMinutes) : 0;
  return minutes ? new Date(event.date.getTime() + minutes * 60_000) : null;
};

/** Construit le PDF d'un billet existant. */
export function buildTicketPDF(params: {
  ticket: Ticket;
  event: Event;
  participant: Participant;
}): Promise<Buffer> {
  const { ticket, event, participant } = params;
  const start = startAfterDoors(event);

  return generateTicketPDF({
    participantName: participant.name,
    eventName: event.name,
    dateLabel: formatDate(event.date),
    timeLabel: formatTime(start ?? event.date),
    doorsLabel: start ? formatTime(event.date) : undefined,
    location: event.location ?? "Lieu à venir",
    code: ticket.code,
    qrCodeDataUrl: ticket.qrCode,
    ticketNumber: ticket.number ?? undefined,
    posterUrl: event.image,
  });
}

/** Nom de fichier sûr pour le téléchargement du billet. */
export function ticketFileName(eventName: string): string {
  const slug = eventName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
  return `${slug || "billet"}_billet.pdf`;
}
