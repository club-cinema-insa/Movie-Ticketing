/** Ajoute des minutes à une heure « HH:mm » et la formate à la française (« 20h », « 20h05 »). */
export function startTimeLabel(time: string, minutesAfter: number): string | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(time);
  if (!match) return null;

  const total = (Number(match[1]) * 60 + Number(match[2]) + minutesAfter) % (24 * 60);
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  return minutes === 0 ? `${hours}h` : `${hours}h${String(minutes).padStart(2, "0")}`;
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
