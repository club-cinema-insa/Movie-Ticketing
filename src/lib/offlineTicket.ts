import { useEffect, useState } from "react";
import { rememberTicket, type SavedTicket } from "@/lib/savedTickets";

/** Mêmes valeurs que dans public/sw.js. */
const CACHE = "billets-v1";
const PUBLIC_PAGE = /^\/events(\/[^/]+\/register)?$/;
const STATIC_FILE = /\/_next\/static\/[^"'\s)\\]+/g;

const keyOf = (url: URL) => new Request(url.origin + url.pathname);

/** Enregistre une page et ses fichiers statiques, si elle n'y est pas déjà. */
async function savePage(cache: Cache, url: URL): Promise<boolean> {
  if (await cache.match(keyOf(url))) return true;
  const page = await fetch(url.href);
  if (!page.ok) return false;
  const html = await page.clone().text();
  await cache.put(keyOf(url), page);
  const files = new Set(html.match(STATIC_FILE) ?? []);
  for (const entry of performance.getEntriesByType("resource")) {
    const file = new URL(entry.name);
    if (file.origin === location.origin && file.pathname.startsWith("/_next/static/")) files.add(file.pathname + file.search);
  }
  await Promise.allSettled([...files].map((file) => cache.add(file)));
  return true;
}

/**
 * Garde le billet sur l'appareil pour qu'il reste affichable sans réseau (service worker + cache du navigateur),
 * et le retient dans la liste « Mes billets ». `url` : lien de la page du billet, à défaut la page courante.
 * Retourne « saved » une fois la copie en place. Sans support du navigateur, rien ne change.
 */
export function useOfflineTicket(ticket: (SavedTicket & { url?: string }) | null): "unknown" | "saved" {
  const [state, setState] = useState<"unknown" | "saved">("unknown");
  const { code, eventId, eventName, date, url } = ticket ?? {};

  useEffect(() => {
    if (!code || !eventId || !eventName || !date) return;
    if (!("serviceWorker" in navigator) || !("caches" in window)) return;
    let cancelled = false;

    const save = async () => {
      await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const cache = await caches.open(CACHE);

      // Les visites suivantes sont enregistrées par le service worker lui-même.
      // À la première, il n'était pas encore actif : on enregistre ici le billet et, si besoin, la page courante.
      if (!(await savePage(cache, new URL(url ?? location.href, location.origin)))) return;
      if (PUBLIC_PAGE.test(location.pathname)) await savePage(cache, new URL(location.href)).catch(() => false);

      rememberTicket({ code, eventId, eventName, date });
      if (!cancelled) setState("saved");
    };

    save().catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [code, eventId, eventName, date, url]);

  return state;
}
