import type { NextApiRequest, NextApiResponse } from "next";
import { branding } from "@/config/branding";

/**
 * GET /api/manifest
 * Manifeste d'application web : permet « Ajouter à l'écran d'accueil » sur smartphone,
 * avec le nom, les couleurs et l'icône du club.
 */
export default function handler(_req: NextApiRequest, res: NextApiResponse) {
  const icon = branding.iconUrl ?? branding.logoUrl;
  res.setHeader("Content-Type", "application/manifest+json; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=3600");
  res.status(200).json({
    name: branding.appName,
    short_name: branding.appShortName,
    description: branding.tagline ?? branding.appName,
    lang: "fr",
    start_url: "/events",
    scope: "/",
    display: "standalone",
    background_color: branding.canvasColor ?? "#ffffff",
    theme_color: branding.secondaryColor,
    icons: [
      { src: icon, sizes: "192x192", type: "image/png" },
      { src: icon, sizes: "512x512", type: "image/png" },
    ],
  });
}
