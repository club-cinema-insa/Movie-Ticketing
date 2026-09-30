import Head from "next/head";
import { branding } from "@/config/branding";

/** Titre de page cohérent (« Page · Nom du club ») et balises de partage de lien. */
export function SiteHead({
  title,
  description,
  image,
  noindex = false,
}: {
  title?: string;
  description?: string;
  image?: string | null;
  noindex?: boolean;
}) {
  const fullTitle = title ? `${title} · ${branding.appName}` : branding.appName;
  const text = description ?? branding.tagline ?? branding.appName;

  return (
    <Head>
      <title>{fullTitle}</title>
      <meta name="description" content={text} />
      {noindex && <meta name="robots" content="noindex, nofollow" />}
      <meta property="og:site_name" content={branding.appName} />
      <meta property="og:type" content="website" />
      <meta property="og:locale" content="fr_FR" />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={text} />
      {image && <meta property="og:image" content={image} />}
      <meta name="twitter:card" content={image ? "summary_large_image" : "summary"} />
    </Head>
  );
}
