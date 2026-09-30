/** Fichier calendrier (.ics) d'une projection, pour « Ajouter au calendrier ». */
const toIcsDate = (date: Date) => date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

const escapeText = (value: string) =>
  value.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\;");

export function buildIcs(params: {
  id: string;
  title: string;
  start: Date;
  durationMinutes?: number;
  location?: string | null;
  description?: string;
}): string {
  const end = new Date(params.start.getTime() + (params.durationMinutes ?? 150) * 60_000);

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Club Cine//Billetterie//FR",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${params.id}@billetterie`,
    `DTSTAMP:${toIcsDate(new Date())}`,
    `DTSTART:${toIcsDate(params.start)}`,
    `DTEND:${toIcsDate(end)}`,
    `SUMMARY:${escapeText(params.title)}`,
    ...(params.location ? [`LOCATION:${escapeText(params.location)}`] : []),
    ...(params.description ? [`DESCRIPTION:${escapeText(params.description)}`] : []),
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}

/** Déclenche le téléchargement d'un fichier texte côté navigateur. */
export function downloadTextFile(fileName: string, content: string, type = "text/calendar;charset=utf-8") {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}
