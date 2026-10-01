const TIME_PATTERN = /^(\d{1,2}):(\d{2})$/;

/** Minutes depuis minuit d'une heure « HH:mm », ou null si elle est invalide. */
function minutesOfDay(time: string): number | null {
  const match = TIME_PATTERN.exec(time);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

/** Minutes entre deux heures « HH:mm » du même jour (négatif si `to` précède `from`), ou null. */
export function minutesBetween(from: string, to: string): number | null {
  const start = minutesOfDay(from);
  const end = minutesOfDay(to);
  return start === null || end === null ? null : end - start;
}

/** Ajoute des minutes à une heure « HH:mm » (même jour, plafonné à 23:59), ou null si elle est invalide. */
export function addMinutesToTime(time: string, minutes: number): string | null {
  const start = minutesOfDay(time);
  if (start === null) return null;
  const total = Math.min(Math.max(start + minutes, 0), 24 * 60 - 1);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

const pad2 = (value: number) => value.toString().padStart(2, "0");

/** Parties date (« YYYY-MM-DD ») et heure (« HH:mm ») d'une date ISO, dans le fuseau du navigateur. */
export function localDateTimeParts(iso: string): { date: string; time: string } | null {
  const value = new Date(iso);
  if (Number.isNaN(value.getTime())) return null;
  return {
    date: `${value.getFullYear()}-${pad2(value.getMonth() + 1)}-${pad2(value.getDate())}`,
    time: `${pad2(value.getHours())}:${pad2(value.getMinutes())}`,
  };
}

/**
 * Prochaine date le même jour de la semaine que `reference`, au moins une semaine plus tard
 * et jamais dans le passé (aujourd'hui compris).
 */
export function nextSameWeekday(reference: Date, today: Date = new Date()): Date {
  const next = new Date(reference);
  next.setDate(next.getDate() + 7);

  const startOfToday = new Date(today);
  startOfToday.setHours(0, 0, 0, 0);
  while (next < startOfToday) next.setDate(next.getDate() + 7);
  return next;
}

/** Date + heure saisies (fuseau du navigateur) → ISO 8601 avec décalage, prêt à envoyer à l'API. */
export function toOffsetIso(date: string, time: string): string | null {
  const value = new Date(`${date}T${time || "00:00"}:00`);
  if (Number.isNaN(value.getTime())) return null;

  const offset = -value.getTimezoneOffset();
  const sign = offset >= 0 ? "+" : "-";
  const abs = Math.abs(offset);
  const p = (n: number) => String(n).padStart(2, "0");

  return (
    `${value.getFullYear()}-${p(value.getMonth() + 1)}-${p(value.getDate())}` +
    `T${p(value.getHours())}:${p(value.getMinutes())}:00${sign}${p(Math.floor(abs / 60))}:${p(abs % 60)}`
  );
}
