import type { BrandingConfig } from "./branding.types";

/** Variables CSS de la charte graphique, dérivées du branding (un fork ne change que sa config). */
export function brandThemeCss(branding: BrandingConfig): string {
  const variables: Record<string, string> = {
    brand: branding.primaryColor,
    "brand-strong": branding.secondaryColor,
    highlight: branding.highlightColor ?? branding.primaryColor,
    accent: branding.accentColor ?? branding.primaryColor,
    ink: branding.inkColor ?? "#0f172a",
    canvas: branding.canvasColor ?? "#f8fafc",
  };

  return `:root{${Object.entries(variables)
    .map(([name, value]) => `--${name}:${value}`)
    .join(";")}}`;
}
