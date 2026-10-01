import { db } from "@/server/db";

type Context = { params: Promise<{ id: string }> };

/** GET /api/posters/[id] : affiche d'une séance. Publique et immuable (l'identifiant change à chaque envoi). */
export async function GET(_request: Request, context: Context) {
  const { id } = await context.params;
  if (!/^[a-z0-9]{20,32}$/.test(id)) return new Response("Introuvable", { status: 404 });

  const poster = await db.poster.findUnique({ where: { id }, select: { data: true, contentType: true } });
  if (!poster) return new Response("Introuvable", { status: 404 });

  return new Response(new Uint8Array(poster.data), {
    headers: {
      "Content-Type": poster.contentType,
      "Cache-Control": "public, max-age=31536000, s-maxage=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
