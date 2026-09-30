import defaultBranding from "./branding.default";
import clubcine from "./branding.clubcine";
import type { BrandingConfig } from "./branding.types";

/** Une marque par fichier `branding.<nom>.ts` ; on la choisit avec NEXT_PUBLIC_BRAND=<nom>. */
const brands: Record<string, BrandingConfig> = {
  default: defaultBranding,
  clubcine,
};

const brandKey = process.env.NEXT_PUBLIC_BRAND?.trim().toLowerCase() ?? "default";

const branding: BrandingConfig = brands[brandKey] ?? defaultBranding;

export { branding };
export type { BrandingConfig };
