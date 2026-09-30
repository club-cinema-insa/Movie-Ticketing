import type { BrandingConfig } from "./branding.types";

// Exemple de branding pour un fork étudiant (actif si NEXT_PUBLIC_BRAND=clubcine).
// Placez vos assets dans /public (ex: /public/clubcine-logo.png).
const brandingClubCine: BrandingConfig = {
  appName: "Club Ciné INSA",
  appShortName: "Club Ciné",
  logoUrl: "/clubcine-logo.png",
  logoAlt: "Club Ciné INSA",
  faviconUrl: "/clubcine-favicon.ico",
  iconUrl: "/clubcine-icon-512.png",
  // Palette tirée du logo : turquoise du fond, orange et jaune du renard, rouge des lunettes, crème.
  primaryColor: "#1a736e",
  secondaryColor: "#124844",
  highlightColor: "#45d2c4",
  accentColor: "#e6932c",
  inkColor: "#0b2e2f",
  canvasColor: "#fbf8ec",
  tagline: "Réservez gratuitement votre place pour les prochaines séances.",
  emailSignature: "L’équipe du Club Ciné INSA",
  eventTermsText: "Les séances sont réservées aux étudiants INSA.",
  startsAfterDoorsMinutes: 15,
  startLabel: "Début de la projection",
};

export default brandingClubCine;
