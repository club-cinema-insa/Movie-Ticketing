import { db } from "@/server/db";

export type AuditAction =
  | "event.create"
  | "event.update"
  | "event.publish"
  | "event.unpublish"
  | "event.delete"
  | "ticket.add"
  | "ticket.cancel"
  | "ticket.cancel_by_student"
  | "ticket.checkin"
  | "ticket.uncheckin"
  | "access.add"
  | "access.remove";

type AuditEntry = {
  /** Membre du bureau ; absent pour une action d'un étudiant. */
  actor?: { userId: string; name: string | null } | null;
  action: AuditAction;
  event?: { id: string; name: string } | null;
  /** Précision courte : nom du participant, champs modifiés… */
  detail?: string | null;
};

/**
 * Enregistre une action dans l'historique du bureau.
 * Ne lève jamais d'exception : le journal ne doit pas empêcher l'action qu'il décrit.
 */
export async function recordAudit(entry: AuditEntry): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        actorId: entry.actor?.userId ?? null,
        actorName: entry.actor?.name?.slice(0, 100) ?? null,
        action: entry.action,
        eventId: entry.event?.id ?? null,
        eventName: entry.event?.name.slice(0, 200) ?? null,
        detail: entry.detail?.slice(0, 300) ?? null,
      },
    });
  } catch (error) {
    console.error("Historique : enregistrement impossible :", error instanceof Error ? error.message : error);
  }
}
