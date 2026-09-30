export type BrandingConfig = {
  appName: string;
  appShortName: string;
  logoUrl: string;
  logoAlt: string;
  faviconUrl: string;
  primaryColor: string;
  secondaryColor: string;
  footerText: string;
  emailSignature: string;
  eventTermsText: string;
  /** Ouverture des portes, en minutes avant le début. Absent : pas de ligne « portes » sur le billet. */
  doorsOpenMinutesBefore?: number;
  /** Libellé de l'heure de début sur le billet (défaut : « Début »). */
  startLabel?: string;
};
