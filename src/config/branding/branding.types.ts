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
  /**
   * Si défini, l'heure de l'événement est l'ouverture des portes et la séance commence
   * ce nombre de minutes plus tard. Absent : le billet affiche une simple « Heure ».
   */
  startsAfterDoorsMinutes?: number;
  /** Libellé de l'heure de début sur le billet (défaut : « Début »). */
  startLabel?: string;
};
