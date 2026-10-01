import { db } from "@/server/db";
import { requireAdmin } from "@/server/auth/guards";
import { MAX_POSTER_BYTES, hostedPosterUrl, sniffImageType } from "@/server/posters/store";

/**
 * POST /api/admin/posters : corps = octets de l'image (JPEG ou PNG, 1,5 Mo maximum).
 * Le formulaire réduit l'image avant l'envoi. Retourne l'adresse à mettre dans le champ « Affiche ».
 */
export async function POST(request: Request) {
  const admin = await requireAdmin();
  if ("response" in admin) return admin.response;

  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_POSTER_BYTES) {
    return Response.json({ error: "Image trop lourde (1,5 Mo maximum)." }, { status: 413 });
  }

  const data = new Uint8Array(await request.arrayBuffer());
  if (data.length === 0 || data.length > MAX_POSTER_BYTES) {
    return Response.json({ error: "Image vide ou trop lourde (1,5 Mo maximum)." }, { status: 413 });
  }

  const contentType = sniffImageType(data);
  if (!contentType) {
    return Response.json({ error: "Format non pris en charge : envoyez un JPEG ou un PNG." }, { status: 400 });
  }

  const poster = await db.poster.create({ data: { data, contentType }, select: { id: true } });
  return Response.json({ url: hostedPosterUrl(poster.id) }, { status: 201 });
}
