import type { BrandingConfig } from "../../../../Event-Ticketing-System/src/config/branding/branding.types";

// Exemple de branding pour un fork étudiant (actif si NEXT_PUBLIC_BRAND=clubcine).
// Placez vos assets dans /public (ex: /public/clubcine-logo.png).
const brandingClubCine: BrandingConfig = {
  appName: "Club Ciné INSA",
  appShortName: "Club Ciné",
  logoUrl: "/clubcine-logo.png",
  logoAlt: "Club Ciné INSA",
  faviconUrl: "/clubcine-favicon.ico",
  primaryColor: "#0f766e",
  secondaryColor: "#115e59",
  footerText: "© 2026 Club Ciné INSA — Projections & culture ciné.",
  emailSignature: "L’équipe du Club Ciné INSA",
  eventTermsText:
    "Les projections sont réservées aux étudiants INSA. Merci d’arriver 10 minutes avant le début.",
};

export default brandingClubCine;
