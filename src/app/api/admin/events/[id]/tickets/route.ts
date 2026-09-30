import { db } from "@/server/db";
import { loadEventForAdmin } from "@/server/auth/guards";
import {
  findOrCreateParticipant,
  findOrCreateTicket,
  parseRegistration,
} from "@/server/tickets/issue";

type Context = { params: Promise<{ id: string }> };

/**
 * GET /api/admin/events/[id]/tickets
 * Inscrits d'une projection, avec leur statut de contrôle.
 */
export async function GET(_req: Request, context: Context) {
  const { id } = await context.params;
  const access = await loadEventForAdmin(id);
  if ("response" in access) return access.response;
  const { event } = access;

  const tickets = await db.ticket.findMany({
    where: { eventId: id },
    include: { participant: { select: { name: true, email: true } } },
    orderBy: [{ number: "asc" }, { createdAt: "asc" }],
  });

  return Response.json({
    event: {
      id: event.id,
      name: event.name,
      date: event.date,
      location: event.location,
      maxTickets: event.maxTickets,
      show: event.show,
    },
    stats: {
      issued: tickets.length,
      checkedIn: tickets.filter((ticket) => ticket.checkedIn).length,
    },
    tickets: tickets.map((ticket) => ({
      id: ticket.id,
      code: ticket.code,
      number: ticket.number,
      createdAt: ticket.createdAt,
      checkedIn: ticket.checkedIn,
      redeemedAt: ticket.redeemedAt,
      participant: ticket.participant,
    })),
  });
}

/**
 * POST /api/admin/events/[id]/tickets
 * Inscription manuelle par le bureau (personne sans réservation, placement exceptionnel).
 * Peut dépasser la capacité et fonctionne aussi sur une projection non publiée.
 */
export async function POST(req: Request, context: Context) {
  const { id } = await context.params;
  const access = await loadEventForAdmin(id);
  if ("response" in access) return access.response;

  const body = (await req.json().catch(() => null)) as { name?: unknown; email?: unknown } | null;
  const parsed = parseRegistration(body ?? {});
  if (!parsed.ok) {
    return Response.json({ error: parsed.error }, { status: 400 });
  }

  const participant = await findOrCreateParticipant(parsed.name, parsed.email);
  const result = await findOrCreateTicket(access.event, participant, { admin: true });

  if (result.kind === "existing") {
    return Response.json(
      { error: "Cette personne a déjà un billet pour cette séance." },
      { status: 409 },
    );
  }
  if (result.kind !== "created") {
    return Response.json({ error: "Impossible de créer le billet." }, { status: 500 });
  }

  return Response.json({ id: result.ticket.id, code: result.ticket.code }, { status: 201 });
}
