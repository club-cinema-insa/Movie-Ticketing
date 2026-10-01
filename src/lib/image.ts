/** Taille maximale du fichier choisi (avant réduction). */
export const MAX_SOURCE_BYTES = 20 * 1024 * 1024;

/**
 * Réduit une image (côté le plus long : 1600 px) et la ré-encode en JPEG de base.
 * Le billet PDF et Discord lisent ainsi toujours l'affiche, et elle reste légère.
 */
export async function prepareImageForUpload(file: File, maxSide = 1600, quality = 0.85): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));

  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas indisponible");
  // Fond blanc : un PNG transparent ne doit pas devenir noir en JPEG.
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
  if (!blob) throw new Error("Encodage impossible");
  return blob;
}
