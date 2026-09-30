/** Adresse publique du site (liens et logo dans les e-mails). Facultative : sans elle, pas de lien. */
export function siteUrl(): string | null {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.SITE_URL;
  if (explicit) return explicit.replace(/\/$/, "");
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  return vercel ? `https://${vercel}` : null;
}
