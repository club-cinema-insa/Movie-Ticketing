import { requireAdmin } from "@/server/auth/guards";
import { searchFilms, tmdbConfigured } from "@/server/tmdb/client";

/** GET /api/admin/tmdb/search?q=… : films correspondant au titre tapé dans le formulaire de séance. */
export async function GET(request: Request) {
  const admin = await requireAdmin();
  if ("response" in admin) return admin.response;

  if (!tmdbConfigured()) {
    return Response.json({ error: "La recherche de film n’est pas configurée (TMDB_API_KEY)." }, { status: 503 });
  }

  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (query.length < 2 || query.length > 100) return Response.json({ results: [] });

  try {
    return Response.json({ results: await searchFilms(query) });
  } catch (error) {
    console.error("TMDB : recherche impossible :", error instanceof Error ? error.message : error);
    return Response.json({ error: "La recherche est momentanément indisponible." }, { status: 502 });
  }
}
