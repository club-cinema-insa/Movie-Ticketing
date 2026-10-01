import { db } from "@/server/db";
import { RETENTION_MONTHS } from "@/config/retention";

/** Domaine factice des adresses effacées (réservé : ne peut jamais être une vraie adresse). */
export const ANONYMIZED_DOMAIN = "@anonymise.invalid";
const ANONYMIZED_NAME = "Participant supprimé";
const BATCH_SIZE = 100;

export type PurgeReport = {
  cutoff: string;
  dryRun: boolean;
  /** Participants dont toutes les séances sont passées depuis plus longtemps que la durée de conservation. */
  anonymized: number;
  /** Participants sans billet (réservation annulée) créés avant la date limite. */
  deleted: number;
};

export function retentionCutoff(now: Date, months = RETENTION_MONTHS): Date {
  const cutoff = new Date(now);
  cutoff.setMonth(cutoff.getMonth() - months);
  return cutoff;
}

/**
 * Efface les données personnelles qui ne servent plus.
 * Les billets sont conservés, rattachés à un participant anonymisé : les statistiques
 * (réservations, présents) restent exactes, mais plus personne n'est identifiable.
 */
export async function purgeExpiredPersonalData(now = new Date(), dryRun = false): Promise<PurgeReport> {
  const cutoff = retentionCutoff(now);
  const notAnonymized = { NOT: { email: { endsWith: ANONYMIZED_DOMAIN } } };

  const toAnonymize = await db.participant.findMany({
    where: { ...notAnonymized, tickets: { some: {}, every: { event: { date: { lt: cutoff } } } } },
    select: { id: true },
  });
  const orphans = await db.participant.findMany({
    where: { ...notAnonymized, tickets: { none: {} }, createdAt: { lt: cutoff } },
    select: { id: true },
  });

  if (!dryRun) {
    for (let i = 0; i < toAnonymize.length; i += BATCH_SIZE) {
      await db.$transaction(
        toAnonymize.slice(i, i + BATCH_SIZE).map(({ id }) =>
          db.participant.update({
            where: { id },
            data: { name: ANONYMIZED_NAME, email: `supprime-${id}${ANONYMIZED_DOMAIN}` },
          }),
        ),
      );
    }
    if (orphans.length > 0) {
      await db.participant.deleteMany({ where: { id: { in: orphans.map(({ id }) => id) } } });
    }
  }

  return { cutoff: cutoff.toISOString(), dryRun, anonymized: toAnonymize.length, deleted: orphans.length };
}
