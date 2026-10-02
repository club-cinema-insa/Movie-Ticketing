import { db } from "@/server/db";
import { requireAdmin } from "@/server/auth/guards";
import { MAX_POSTER_BYTES, hostedPosterUrl, sniffImageType } from "@/server/posters/store";
import { filmDetails, isTmdbImagePath, tmdbConfigured } from "@/server/tmdb/client";

const IMAGE_TIMEOUT_MS = 8000;

/**
 * POST /api/admin/tmdb/import { id } : informations d'un film pour préremplir le formulaire.
 * L'image est téléchargée puis hébergée ici (comme une affiche envoyée à la main) ;
 * si elle est inutilisable, le reste des informations est quand même renvoyé.
 */
export async function POST(request: Request) {
  const admin = await requireAdmin();
  if ("response" in admin) return admin.response;

  if (!tmdbConfigured()) {
    return Response.json({ error: "La recherche de film n’est pas configurée (TMDB_API_KEY)." }, { status: 503 });
  }

  const body = (await request.json().catch(() => null)) as { id?: unknown } | null;
  const id = typeof body?.id === "number" && Number.isInteger(body.id) && body.id > 0 ? body.id : null;
  if (!id) return Response.json({ error: "Film invalide." }, { status: 400 });

  let film;
  try {
    film = await filmDetails(id);
  } catch (error) {
    console.error("TMDB : fiche impossible :", error instanceof Error ? error.message : error);
    return Response.json({ error: "Ce film n’a pas pu être récupéré." }, { status: 502 });
  }

  let image: string | null = null;
  if (film.imageUrl && film.imagePath && isTmdbImagePath(film.imagePath)) {
    try {
      const res = await fetch(film.imageUrl, { signal: AbortSignal.timeout(IMAGE_TIMEOUT_MS) });
      const data = new Uint8Array(await res.arrayBuffer());
      const contentType = res.ok && data.length <= MAX_POSTER_BYTES ? sniffImageType(data) : null;
      if (contentType) {
        const poster = await db.poster.create({ data: { data, contentType }, select: { id: true } });
        image = hostedPosterUrl(poster.id);
      }
    } catch {
      // Sans image, le bureau peut toujours en envoyer une à la main.
    }
  }

  return Response.json({
    title: film.title,
    overview: film.overview,
    director: film.director,
    runtimeMinutes: film.runtimeMinutes,
    image,
  });
}
