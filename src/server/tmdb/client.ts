import { env } from "@/env";

const API_BASE = env.TMDB_API_BASE ?? "https://api.themoviedb.org/3";
const IMAGE_BASE = env.TMDB_IMAGE_BASE ?? "https://image.tmdb.org/t/p";
const TIMEOUT_MS = 8000;

export class TmdbError extends Error {
  constructor(readonly status: number) {
    super(`TMDB ${status}`);
  }
}

export const tmdbConfigured = () => Boolean(env.TMDB_API_KEY);

/** Le « jeton d'accès en lecture » (long, de type JWT) s'envoie en en-tête, la « clé API » en paramètre. */
async function get<T>(path: string, params: Record<string, string>): Promise<T> {
  const key = env.TMDB_API_KEY ?? "";
  const bearer = key.length > 40;
  const url = new URL(`${API_BASE}${path}`);
  for (const [name, value] of Object.entries(params)) url.searchParams.set(name, value);
  if (!bearer) url.searchParams.set("api_key", key);

  const res = await fetch(url, {
    headers: bearer ? { Authorization: `Bearer ${key}` } : undefined,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new TmdbError(res.status);
  return (await res.json()) as T;
}

export type FilmSummary = {
  id: number;
  title: string;
  originalTitle: string | null;
  year: string | null;
  posterThumb: string | null;
};

type RawSearch = {
  results?: { id: number; title?: string; original_title?: string; release_date?: string; poster_path?: string | null }[];
};

export async function searchFilms(query: string): Promise<FilmSummary[]> {
  const data = await get<RawSearch>("/search/movie", { query, language: "fr-FR", include_adult: "false" });
  return (data.results ?? []).slice(0, 8).map((film) => ({
    id: film.id,
    title: film.title ?? film.original_title ?? "Sans titre",
    originalTitle: film.original_title && film.original_title !== film.title ? film.original_title : null,
    year: film.release_date ? film.release_date.slice(0, 4) : null,
    posterThumb: film.poster_path ? `${IMAGE_BASE}/w92${film.poster_path}` : null,
  }));
}

type RawDetails = {
  title?: string;
  overview?: string;
  runtime?: number | null;
  backdrop_path?: string | null;
  poster_path?: string | null;
  credits?: { crew?: { job?: string; name?: string }[] };
};

export type FilmDetails = {
  title: string;
  overview: string;
  director: string | null;
  runtimeMinutes: number | null;
  /** Image paysage de préférence (le site affiche des visuels 16/10), sinon l'affiche portrait. */
  imagePath: string | null;
  imageUrl: string | null;
};

export async function filmDetails(id: number): Promise<FilmDetails> {
  const fr = await get<RawDetails>(`/movie/${id}`, { language: "fr-FR", append_to_response: "credits" });
  // Certains films n'ont pas de synopsis français : on prend la version anglaise plutôt que rien.
  let overview = fr.overview?.trim() ?? "";
  if (!overview) {
    const en = await get<RawDetails>(`/movie/${id}`, { language: "en-US" }).catch(() => null);
    overview = en?.overview?.trim() ?? "";
  }

  const imagePath = fr.backdrop_path ?? fr.poster_path ?? null;
  return {
    title: fr.title ?? "",
    overview,
    director: fr.credits?.crew?.find((member) => member.job === "Director")?.name ?? null,
    runtimeMinutes: fr.runtime && fr.runtime > 0 ? fr.runtime : null,
    imagePath,
    imageUrl: imagePath ? `${IMAGE_BASE}/${fr.backdrop_path ? "w1280" : "w780"}${imagePath}` : null,
  };
}

/** Chemin d'image TMDB légitime (évite de télécharger autre chose que ce que l'API a renvoyé). */
export const isTmdbImagePath = (path: string) => /^\/[A-Za-z0-9_-]+\.(jpg|png)$/.test(path);
