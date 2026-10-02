import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Field, Input } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";

type Film = { id: number; title: string; originalTitle: string | null; year: string | null; posterThumb: string | null };

export type ImportedFilm = {
  title: string;
  overview: string;
  director: string | null;
  runtimeMinutes: number | null;
  image: string | null;
};

/**
 * Recherche d'un film (base TMDB) : choisir un résultat préremplit le nom, le synopsis, le réalisateur,
 * la durée et l'affiche du formulaire de séance.
 */
export function FilmSearch({ onImport }: { onImport: (film: ImportedFilm) => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Film[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [importingId, setImportingId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const requestId = useRef(0);

  useEffect(() => {
    const text = query.trim();
    if (text.length < 2) {
      setResults(null);
      setError("");
      return;
    }

    const current = ++requestId.current;
    const timer = setTimeout(() => {
      void (async () => {
        setSearching(true);
        try {
          const res = await fetch(`/api/admin/tmdb/search?q=${encodeURIComponent(text)}`);
          const data = (await res.json().catch(() => ({}))) as { results?: Film[]; error?: string };
          if (current !== requestId.current) return;
          if (!res.ok) {
            setResults(null);
            setError(data.error ?? "La recherche a échoué.");
            return;
          }
          setError("");
          setResults(data.results ?? []);
        } catch {
          if (current === requestId.current) setError("Connexion impossible. Réessayez.");
        } finally {
          if (current === requestId.current) setSearching(false);
        }
      })();
    }, 350);

    return () => clearTimeout(timer);
  }, [query]);

  const choose = async (film: Film) => {
    setImportingId(film.id);
    setError("");
    try {
      const res = await fetch("/api/admin/tmdb/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: film.id }),
      });
      const data = (await res.json().catch(() => ({}))) as ImportedFilm & { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Ce film n’a pas pu être récupéré.");
        return;
      }
      onImport(data);
      setQuery("");
      setResults(null);
    } catch {
      setError("Connexion impossible. Réessayez.");
    } finally {
      setImportingId(null);
    }
  };

  return (
    <div className="space-y-3 rounded-2xl bg-brand-tint p-4 ring-1 ring-brand/10">
      <Field
        label="Rechercher un film"
        htmlFor="field-film-search"
        optional
        hint="Tapez le titre : le nom, le synopsis, le réalisateur, la durée et l’affiche se remplissent. Vous pouvez tout modifier ensuite."
      >
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-subtle" aria-hidden />
          <Input
            id="field-film-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Alien, Le Voyage de Chihiro…"
            autoComplete="off"
            className="pl-10"
          />
          {searching && (
            <span className="absolute right-3.5 top-1/2 -translate-y-1/2" aria-hidden>
              <Spinner className="size-4" />
            </span>
          )}
        </div>
      </Field>

      {error && <Alert tone="danger">{error}</Alert>}

      {results && results.length === 0 && !searching && <p className="text-sm text-subtle">Aucun film trouvé pour « {query.trim()} ».</p>}

      {results && results.length > 0 && (
        <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
          {results.map((film) => (
            <li key={film.id}>
              <button
                type="button"
                onClick={() => void choose(film)}
                disabled={importingId !== null}
                className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition hover:bg-muted disabled:opacity-60"
              >
                {film.posterThumb ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={film.posterThumb} alt="" width={36} height={54} className="h-[54px] w-9 shrink-0 rounded-md bg-muted object-cover" />
                ) : (
                  <span className="h-[54px] w-9 shrink-0 rounded-md bg-muted" aria-hidden />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{film.title}</span>
                  <span className="block truncate text-sm text-subtle">
                    {[film.year, film.originalTitle].filter(Boolean).join(" · ")}
                  </span>
                </span>
                {importingId === film.id && <Spinner className="size-4" />}
              </button>
            </li>
          ))}
        </ul>
      )}

      <p className="text-xs text-subtle">Informations et visuels : TMDB. Ce site n’est ni approuvé ni certifié par TMDB.</p>
    </div>
  );
}
