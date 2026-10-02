import { db } from "@/server/db";

/** Taille maximale d'une affiche enregistrée (le navigateur réduit l'image avant l'envoi). */
export const MAX_POSTER_BYTES = 1_500_000;

const HOSTED_PATTERN = /^\/api\/posters\/([a-z0-9]{20,32})$/;

export const hostedPosterUrl = (id: string) => `/api/posters/${id}`;

/** Identifiant d'une affiche hébergée ici, ou null pour une autre adresse. */
export function hostedPosterId(src: string | null | undefined): string | null {
  return HOSTED_PATTERN.exec(src ?? "")?.[1] ?? null;
}

/**
 * Type de l'image d'après ses octets (JPEG de base ou PNG), sinon null.
 * On vérifie aussi la fin du fichier : une image tronquée serait enregistrée corrompue.
 */
export function sniffImageType(data: Uint8Array): "image/jpeg" | "image/png" | null {
  if (data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) {
    return !isProgressiveJpeg(data) && endsWithJpegMarker(data) ? "image/jpeg" : null;
  }
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  return png.every((byte, index) => data[index] === byte) && endsWithPngTrailer(data) ? "image/png" : null;
}

/** Un JPEG complet se termine par le marqueur FF D9 (éventuellement suivi d'octets nuls). */
function endsWithJpegMarker(data: Uint8Array): boolean {
  let end = data.length;
  while (end > 2 && data[end - 1] === 0) end--;
  return data[end - 2] === 0xff && data[end - 1] === 0xd9;
}

/** Un PNG complet se termine par le bloc IEND. */
function endsWithPngTrailer(data: Uint8Array): boolean {
  const iend = [0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82];
  return iend.every((byte, index) => data[data.length - 8 + index] === byte);
}

/** pdfkit (billet PDF) ne lit pas les JPEG progressifs : on les refuse plutôt que d'avoir un billet sans affiche. */
function isProgressiveJpeg(data: Uint8Array): boolean {
  let offset = 2;
  while (offset + 4 < data.length) {
    if (data[offset] !== 0xff) return false;
    const marker = data[offset + 1]!;
    if (marker === 0xc2) return true;
    if (marker === 0xc0 || marker === 0xc1) return false;
    offset += 2 + ((data[offset + 2]! << 8) | data[offset + 3]!);
  }
  return false;
}

/** Contenu d'une affiche hébergée ici (billet PDF, séance Discord), ou null si elle n'existe pas. */
export async function loadHostedPoster(src: string): Promise<{ data: Buffer; contentType: string } | null> {
  const id = hostedPosterId(src);
  if (!id) return null;
  const poster = await db.poster.findUnique({ where: { id }, select: { data: true, contentType: true } });
  return poster ? { data: Buffer.from(poster.data), contentType: poster.contentType } : null;
}

/** Supprime l'affiche hébergée correspondant à cette adresse (sans effet pour une adresse externe). */
export async function deleteHostedPoster(src: string | null | undefined): Promise<void> {
  const id = hostedPosterId(src);
  if (!id) return;
  try {
    await db.poster.deleteMany({ where: { id } });
  } catch (error) {
    console.error("Affiche : suppression impossible :", error instanceof Error ? error.message : error);
  }
}
