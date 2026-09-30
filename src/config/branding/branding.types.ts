export type BrandingConfig = {
  appName: string;
  appShortName: string;
  logoUrl: string;
  logoAlt: string;
  faviconUrl: string;
  /** Icône PNG carrée (≥ 512 px) : écran d'accueil du téléphone et partage de liens. */
  iconUrl?: string;
  /** Couleur d'action principale (boutons, liens) : doit contraster avec du blanc. */
  primaryColor: string;
  /** Version plus sombre de la couleur principale (survol, surfaces sombres). */
  secondaryColor: string;
  /** Couleur vive du logo, pour les touches décoratives et le focus. */
  highlightColor?: string;
  /** Couleur des appels à l'action (ex. « Réserver ») : texte foncé dessus. */
  accentColor?: string;
  /** Couleur du texte et des surfaces très sombres. */
  inkColor?: string;
  /** Fond des pages. */
  canvasColor?: string;
  /** Accroche affichée sous le titre de la page d'accueil. */
  tagline?: string;
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
