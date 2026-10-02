import { useEffect, useState } from "react";

/** Billets gardés sur l'appareil pour les retrouver sans réseau (voir offlineTicket.ts). */
export type SavedTicket = { code: string; eventId: string; eventName: string; date: string };

const KEY = "clubcine.billets";
const CHANGED = "clubcine:billets";
const KEEP_AFTER_EVENT_MS = 24 * 3_600_000;

function read(): SavedTicket[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return (parsed as Partial<SavedTicket>[]).filter(
      (t): t is SavedTicket =>
        typeof t.code === "string" && typeof t.eventId === "string" && typeof t.eventName === "string" && typeof t.date === "string",
    );
  } catch {
    return [];
  }
}

function write(tickets: SavedTicket[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(tickets));
    window.dispatchEvent(new Event(CHANGED));
  } catch {
    // Stockage indisponible (navigation privée, quota) : le billet reste simplement non listé.
  }
}

export function rememberTicket(ticket: SavedTicket) {
  write([...read().filter((t) => t.code !== ticket.code && t.eventId !== ticket.eventId), ticket]);
}

export function forgetTicket(code: string) {
  write(read().filter((t) => t.code !== code));
}

/** Billets des séances à venir, du plus proche au plus lointain. Vide tant que la page n'est pas affichée côté navigateur. */
export function useSavedTickets(): SavedTicket[] {
  const [tickets, setTickets] = useState<SavedTicket[]>([]);

  useEffect(() => {
    const refresh = () => {
      const limit = Date.now() - KEEP_AFTER_EVENT_MS;
      const all = read();
      const upcoming = all.filter((t) => new Date(t.date).getTime() > limit);
      if (upcoming.length !== all.length) write(upcoming);
      setTickets(upcoming.sort((a, b) => a.date.localeCompare(b.date)));
    };
    refresh();
    window.addEventListener(CHANGED, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(CHANGED, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  return tickets;
}
