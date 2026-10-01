/** Données minimales nécessaires au calcul (séances avec leurs billets). */
export type StatsEvent = {
  id: string;
  name: string;
  date: Date;
  maxTickets: number | null;
  tickets: { participantId: string; checkedIn: boolean; createdAt: Date }[];
};

export type SessionStats = {
  id: string;
  name: string;
  date: string;
  capacity: number | null;
  reservations: number;
  attendees: number;
  /** Réservations dont le billet n'a pas été validé à l'entrée. */
  noShows: number;
  attendanceRate: number | null;
  fillRate: number | null;
  /** Spectateurs dont c'est la toute première séance. */
  newParticipants: number;
};

export type StatsResponse = {
  /** Période analysée en mois (0 : depuis le début). */
  months: number;
  totals: {
    sessions: number;
    reservations: number;
    attendees: number;
    /** Part des réservations venues à l'entrée (0 à 1). */
    attendanceRate: number | null;
    averageAttendees: number | null;
    /** Taux de remplissage moyen des séances à capacité limitée (0 à 1). */
    averageFill: number | null;
    /** Personnes différentes ayant réservé sur la période. */
    uniqueParticipants: number;
    /** Parmi elles, celles qui ont réservé au moins deux séances. */
    returningParticipants: number;
  };
  upcoming: { sessions: number; reservations: number };
  /** Séances passées de la période, de la plus ancienne à la plus récente. */
  sessions: SessionStats[];
  /** Délai entre la réservation et la séance. */
  leadTime: { sameDay: number; oneToTwoDays: number; threeToSevenDays: number; overAWeek: number };
};

const DAY_MS = 86_400_000;

const ratio = (part: number, whole: number) => (whole > 0 ? part / whole : null);

/**
 * Calcule les statistiques de fréquentation.
 * `events` contient toutes les séances accessibles : l'historique complet sert à savoir
 * si une personne vient pour la première fois, même quand la période est restreinte.
 */
export function computeStats(events: StatsEvent[], months: number, now = new Date()): StatsResponse {
  const sorted = [...events].sort((a, b) => a.date.getTime() - b.date.getTime());

  // Première séance de chaque personne, sur tout l'historique.
  const firstEventOf = new Map<string, string>();
  for (const event of sorted) {
    for (const ticket of event.tickets) {
      if (!firstEventOf.has(ticket.participantId)) firstEventOf.set(ticket.participantId, event.id);
    }
  }

  const periodStart = months > 0 ? new Date(now) : null;
  periodStart?.setMonth(periodStart.getMonth() - months);

  const past = sorted.filter((event) => event.date < now && (!periodStart || event.date >= periodStart));
  const upcomingEvents = sorted.filter((event) => event.date >= now);

  const sessions: SessionStats[] = past.map((event) => {
    const reservations = event.tickets.length;
    const attendees = event.tickets.filter((ticket) => ticket.checkedIn).length;
    return {
      id: event.id,
      name: event.name,
      date: event.date.toISOString(),
      capacity: event.maxTickets,
      reservations,
      attendees,
      noShows: reservations - attendees,
      attendanceRate: ratio(attendees, reservations),
      fillRate: event.maxTickets ? Math.min(1, reservations / event.maxTickets) : null,
      newParticipants: event.tickets.filter((ticket) => firstEventOf.get(ticket.participantId) === event.id).length,
    };
  });

  const reservations = sessions.reduce((sum, session) => sum + session.reservations, 0);
  const attendees = sessions.reduce((sum, session) => sum + session.attendees, 0);
  const limited = sessions.filter((session) => session.fillRate !== null);

  const ticketsPerParticipant = new Map<string, number>();
  const leadTime = { sameDay: 0, oneToTwoDays: 0, threeToSevenDays: 0, overAWeek: 0 };
  for (const event of past) {
    for (const ticket of event.tickets) {
      ticketsPerParticipant.set(ticket.participantId, (ticketsPerParticipant.get(ticket.participantId) ?? 0) + 1);

      const days = (event.date.getTime() - ticket.createdAt.getTime()) / DAY_MS;
      if (days < 1) leadTime.sameDay++;
      else if (days < 3) leadTime.oneToTwoDays++;
      else if (days <= 7) leadTime.threeToSevenDays++;
      else leadTime.overAWeek++;
    }
  }

  return {
    months,
    totals: {
      sessions: sessions.length,
      reservations,
      attendees,
      attendanceRate: ratio(attendees, reservations),
      averageAttendees: ratio(attendees, sessions.length),
      averageFill: limited.length > 0 ? limited.reduce((sum, session) => sum + (session.fillRate ?? 0), 0) / limited.length : null,
      uniqueParticipants: ticketsPerParticipant.size,
      returningParticipants: [...ticketsPerParticipant.values()].filter((count) => count >= 2).length,
    },
    upcoming: {
      sessions: upcomingEvents.length,
      reservations: upcomingEvents.reduce((sum, event) => sum + event.tickets.length, 0),
    },
    sessions,
    leadTime,
  };
}
