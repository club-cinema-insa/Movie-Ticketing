// Billet disponible hors connexion.
// Ne touche qu'à la page /billet/<code> et à ses fichiers statiques : le reste du site passe par le réseau.
// Rien n'est stocké en dehors de l'appareil de l'étudiant.

const CACHE = "billets-v1";
const TICKET_PAGE = /^\/billet\/TICKET-[A-Z0-9]{8,16}$/;
const STATIC_FILE = /^\/_next\/static\/|\.(?:png|ico|svg|webp|woff2?)$/;

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

// La page est mise en cache sans sa partie « ?t=… » : une seule copie par billet.
const pageKey = (url) => new Request(url.origin + url.pathname);

async function ticketPage(request, url) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) await cache.put(pageKey(url), response.clone());
    // Billet annulé ou supprimé : on ne garde pas de QR code périmé.
    else if (response.status === 404) await cache.delete(pageKey(url));
    return response;
  } catch {
    const saved = await cache.match(pageKey(url));
    if (saved) return saved;
    throw new Error("offline");
  }
}

// Fichiers de /_next/static : leur nom change à chaque version, la copie reste donc toujours valable.
// Les autres (logos) sont servis depuis la copie puis rafraîchis en arrière-plan.
async function staticFile(request, url) {
  const cache = await caches.open(CACHE);
  const saved = await cache.match(request);
  const refresh = () =>
    fetch(request).then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    });
  if (saved) {
    if (!url.pathname.startsWith("/_next/static/")) refresh().catch(() => {});
    return saved;
  }
  return refresh();
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate" && TICKET_PAGE.test(url.pathname)) {
    event.respondWith(ticketPage(request, url));
  } else if (STATIC_FILE.test(url.pathname)) {
    event.respondWith(staticFile(request, url));
  }
});
