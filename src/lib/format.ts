import { branding } from "@/config/branding";

/**
 * Fuseau des projections. Toujours explicite : le serveur (UTC) et le navigateur
 * produisent ainsi exactement le même texte, sans écart d'hydratation.
 */
export const EVENT_TIME_ZONE = process.env.NEXT_PUBLIC_EVENT_TIME_ZONE ?? "Europe/Paris";

const format = (iso: string | Date, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("fr-FR", { ...options, timeZone: EVENT_TIME_ZONE }).format(new Date(iso));

/** « jeudi 1 octobre » */
export const formatDay = (iso: string | Date) => format(iso, { weekday: "long", day: "numeric", month: "long" });

/** « jeudi 1 octobre 2026 » */
export const formatDayWithYear = (iso: string | Date) =>
  format(iso, { weekday: "long", day: "numeric", month: "long", year: "numeric" });

/** « jeu. 1 oct. » */
export const formatDayShort = (iso: string | Date) => format(iso, { weekday: "short", day: "numeric", month: "short" });

/** « jeu. 1 oct., 19h45 » */
export const formatDayTimeShort = (iso: string | Date) => `${formatDayShort(iso)}, ${formatTime(iso)}`;

/** « 19h45 », « 20h » : à la française, sans « :00 » superflu. */
export function formatTime(iso: string | Date): string {
  const parts = new Intl.DateTimeFormat("fr-FR", {
    hour: "numeric",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: EVENT_TIME_ZONE,
  }).formatToParts(new Date(iso));
  const hour = parts.find((part) => part.type === "hour")?.value ?? "";
  const minute = parts.find((part) => part.type === "minute")?.value ?? "00";
  return minute === "00" ? `${hour}h` : `${hour}h${minute}`;
}

/** Pastille de date : jour du mois et mois abrégé. */
export function dateBadgeParts(iso: string | Date): { weekday: string; day: string; month: string } {
  return {
    weekday: format(iso, { weekday: "short" }).replace(".", ""),
    day: format(iso, { day: "numeric" }),
    month: format(iso, { month: "short" }).replace(".", ""),
  };
}

/**
 * Horaires d'une projection : si le club distingue ouverture des portes et début,
 * l'heure enregistrée est l'ouverture des portes et le début se règle séance par séance
 * (`startOffsetMinutes`, sinon le délai habituel du club).
 */
export function eventSchedule(
  iso: string | Date,
  startOffsetMinutes?: number | null,
): { doors: string | null; start: string; startLabel: string } {
  const minutes = branding.startsAfterDoorsMinutes ? (startOffsetMinutes ?? branding.startsAfterDoorsMinutes) : 0;
  if (!minutes) return { doors: null, start: formatTime(iso), startLabel: "Heure" };

  const start = new Date(new Date(iso).getTime() + minutes * 60_000);
  return { doors: formatTime(iso), start: formatTime(start), startLabel: branding.startLabel ?? "Début" };
}

/** Places restantes, ou null quand la capacité est illimitée. */
export function remainingSeats(maxTickets: number | null | undefined, issued: number): number | null {
  return maxTickets ? Math.max(0, maxTickets - issued) : null;
}
