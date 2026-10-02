import { useEffect, useState } from "react";

/** Même nom que dans public/sw.js. */
const CACHE = "billets-v1";
const STATIC_FILE = /^\/_next\/static\/|\.(?:png|ico|svg|webp|woff2?)$/;

/**
 * Garde le billet sur l'appareil pour qu'il reste affichable sans réseau (service worker + cache du navigateur).
 * Retourne « saved » une fois la copie en place. Sans support du navigateur, rien ne change.
 */
export function useOfflineTicket(enabled: boolean): "unknown" | "saved" {
  const [state, setState] = useState<"unknown" | "saved">("unknown");

  useEffect(() => {
    if (!enabled || !("serviceWorker" in navigator) || !("caches" in window)) return;
    let cancelled = false;

    const save = async () => {
      await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const cache = await caches.open(CACHE);
      const key = new Request(location.origin + location.pathname);

      // Les visites suivantes sont enregistrées par le service worker lui-même.
      // À la première, il n'était pas encore actif : on enregistre la page et ses fichiers ici.
      if (!(await cache.match(key))) {
        const page = await fetch(location.href);
        if (!page.ok) return;
        await cache.put(key, page);
        const files = performance
          .getEntriesByType("resource")
          .map((entry) => new URL(entry.name))
          .filter((url) => url.origin === location.origin && STATIC_FILE.test(url.pathname));
        await Promise.allSettled(files.map((url) => cache.add(url.href)));
      }
      if (!cancelled) setState("saved");
    };

    save().catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return state;
}
