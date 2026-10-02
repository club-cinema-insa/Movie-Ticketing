import type { Event } from "@prisma/client";
import { EVENT_TIME_ZONE, eventSchedule, eventStartDate } from "@/lib/format";

/** Neutralise le balisage Discord et les mentions dans un texte saisi par le bureau. */
export function escapeDiscord(text: string): string {
  return text
    .replace(/([\\*_~`|>])/g, "\\$1")
    .replace(/@(everyone|here)/gi, "@​$1")
    .replace(/<(@|#|@&|:)/g, "<​$1")
    .trim();
}

const parisParts = (date: Date) => {
  const parts = new Intl.DateTimeFormat("fr-FR", {
    timeZone: EVENT_TIME_ZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "numeric",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return { weekday: get("weekday"), day: get("day"), month: get("month"), year: get("year"), hour: Number(get("hour")) };
};

const parisDayNumber = (date: Date) =>
  Math.floor(
    new Date(date.toLocaleString("en-US", { timeZone: EVENT_TIME_ZONE })).setHours(0, 0, 0, 0) / 86_400_000,
  );

/** « ce jeudi » dans la semaine qui vient, sinon « le jeudi 10 avril » : le jour vient de la date de la séance. */
function whenPhrase(date: Date, now: Date): { when: string; closing: string } {
  const { weekday, day, month, hour } = parisParts(date);
  const daysAway = parisDayNumber(date) - parisDayNumber(now);
  if (daysAway >= 0 && daysAway <= 6) {
    return { when: `ce ${weekday}`, closing: `${weekday}${hour >= 18 ? " soir" : ""}` };
  }
  const full = `le ${weekday} ${day} ${month}`;
  return { when: full, closing: full };
}

/** Synopsis tronqué proprement (retour à la ligne ou fin de phrase). */
function excerpt(text: string, max: number): string {
  const clean = text.trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const end = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("\n"));
  return end > max * 0.5 ? cut.slice(0, end + 1) : `${cut.trimEnd()}…`;
}

type SessionForMessage = Pick<
  Event,
  "id" | "name" | "date" | "location" | "description" | "maxTickets" | "startOffsetMinutes" | "announceEmojis" | "director"
>;

/** Emojis par défaut quand le bureau n'en a pas choisi pour le film. */
const DEFAULT_EMOJIS = ":clapper::popcorn:";

/**
 * Emojis choisis par le bureau (caractères emoji ou noms comme :european_castle:).
 * On retire tout ce qui pourrait mentionner quelqu'un ou casser la mise en forme.
 */
export function cleanEmojis(text: string | null | undefined): string {
  const cleaned = (text ?? "").replace(/[@<>\\*~`|]/g, "").replace(/\s+/g, " ").trim();
  return cleaned || DEFAULT_EMOJIS;
}

/** Annonce publique d'une nouvelle séance, dans le style des annonces habituelles du club. */
export function buildAnnouncement(
  event: SessionForMessage,
  options: { bookingUrl: string | null; discordEventUrl: string | null; now?: Date },
): string {
  const now = options.now ?? new Date();
  const name = escapeDiscord(event.name);
  const schedule = eventSchedule(event.date, event.startOffsetMinutes);
  const { when, closing } = whenPhrase(eventStartDate(event.date, event.startOffsetMinutes), now);

  const timing = schedule.doors
    ? `${when} : ouverture des portes à ${schedule.doors}, ${schedule.startLabel.toLowerCase()} à ${schedule.start}`
    : `${when} à ${schedule.start}`;
  const seats = event.maxTickets
    ? `La projection est bien évidemment gratuite, toutefois les places sont limitées (${event.maxTickets}) ! Réservez dès maintenant votre place ici :point_down:`
    : "La projection est bien évidemment gratuite ! Réservez dès maintenant votre place ici :point_down:";

  const lines = [
    `**PROJECTION DU FILM ${name.toUpperCase()}**`,
    "",
    `Le club ciné vous propose la projection du film **${name}**${event.director?.trim() ? ` réalisé par ${escapeDiscord(event.director)}` : ""}.`,
  ];

  const synopsis = event.description?.trim();
  if (synopsis) {
    lines.push("", "__:film_frames: Pitch du film__", escapeDiscord(excerpt(synopsis, 900)));
  }

  lines.push(
    "",
    "__:question: Comment ça se passe ?__",
    "Voici les infos essentielles pour participer à cette projection :",
    `• La séance aura lieu ${timing}.`,
  );
  if (event.location) lines.push(`• Lieu : ${escapeDiscord(event.location)}.`);
  lines.push(`• ${seats}`);
  if (options.bookingUrl) lines.push(options.bookingUrl);

  lines.push("", `Hâte de vous retrouver ${closing} ! @everyone ${cleanEmojis(event.announceEmojis)}`);
  if (options.discordEventUrl) lines.push(options.discordEventUrl);

  return lines.join("\n").slice(0, 2000);
}

/** Description de la séance Discord (1000 caractères maximum). */
export function buildEventDescription(event: SessionForMessage, bookingUrl: string | null): string {
  const parts: string[] = [];
  if (event.description?.trim()) parts.push(excerpt(event.description, 700));
  parts.push(
    `Séance gratuite${event.maxTickets ? `, places limitées (${event.maxTickets})` : ""}. ${
      bookingUrl ? `Réservation : ${bookingUrl}` : "Réservation sur le site du club."
    }`,
  );
  return parts.join("\n\n").slice(0, 1000);
}

/** Alerte privée du bureau quand une séance n'a plus de place. */
export function buildFullAlert(event: Pick<SessionForMessage, "name" | "maxTickets">, bookingUrl: string | null): string {
  return [
    `**Séance complète : ${escapeDiscord(event.name)}**`,
    `Les ${event.maxTickets} places sont réservées.${bookingUrl ? ` ${bookingUrl}` : ""}`,
  ].join("\n");
}
