import type { Event, Participant, Ticket } from "@prisma/client";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/server/auth/config";
import { canAccessEvent } from "@/server/auth/access";
import { db } from "@/server/db";

type Failure = { response: Response };

const fail = (error: string, status: number): Failure => ({
  response: Response.json({ error }, { status }),
});

/** Membre du bureau connecté ; `name` sert à l'historique des actions. */
export type Actor = { userId: string; name: string | null };

/** Session admin obligatoire (les comptes non autorisés n'ont jamais de session). */
export async function requireAdmin(): Promise<Actor | Failure> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return fail("Non autorisé", 401);
  return { userId: session.user.id, name: session.user.name ?? null };
}

/** Projection accessible à l'admin connecté, sinon réponse d'erreur prête à renvoyer. */
export async function loadEventForAdmin(
  eventId: string,
): Promise<(Actor & { event: Event }) | Failure> {
  const admin = await requireAdmin();
  if ("response" in admin) return admin;

  const event = await db.event.findUnique({ where: { id: eventId } });
  if (!event) return fail("Séance introuvable", 404);
  if (!canAccessEvent(event, admin.userId)) return fail("Accès refusé", 403);

  return { ...admin, event };
}

/** Billet dont la projection est accessible à l'admin connecté. */
export async function loadTicketForAdmin(
  ticketId: string,
): Promise<(Actor & { ticket: Ticket & { event: Event; participant: Participant } }) | Failure> {
  const admin = await requireAdmin();
  if ("response" in admin) return admin;

  const ticket = await db.ticket.findUnique({
    where: { id: ticketId },
    include: { event: true, participant: true },
  });
  if (!ticket) return fail("Billet introuvable", 404);
  if (!canAccessEvent(ticket.event, admin.userId)) return fail("Accès refusé", 403);

  return { ...admin, ticket };
}
