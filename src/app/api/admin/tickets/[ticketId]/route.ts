import { db } from "@/server/db";
import { loadTicketForAdmin } from "@/server/auth/guards";

type Context = { params: Promise<{ ticketId: string }> };

/**
 * ✏️ PATCH /api/admin/tickets/[ticketId]
 * Corps : { checkedIn: boolean } — validation manuelle (QR perdu) ou annulation d'une validation.
 */
export async function PATCH(req: Request, context: Context) {
  const { ticketId } = await context.params;
  const access = await loadTicketForAdmin(ticketId);
  if ("response" in access) return access.response;

  const body = (await req.json().catch(() => null)) as { checkedIn?: unknown } | null;
  if (typeof body?.checkedIn !== "boolean") {
    return Response.json({ error: "checkedIn (booléen) requis." }, { status: 400 });
  }

  // Conditionnel : si un scan a validé le billet entre-temps, on ne l'écrase pas.
  const { count } = await db.ticket.updateMany({
    where: { id: ticketId, checkedIn: !body.checkedIn },
    data: body.checkedIn
      ? { checkedIn: true, redeemedAt: new Date() }
      : { checkedIn: false, redeemedAt: null },
  });

  const ticket = await db.ticket.findUnique({ where: { id: ticketId } });
  return Response.json({
    changed: count > 0,
    checkedIn: ticket?.checkedIn ?? false,
    redeemedAt: ticket?.redeemedAt ?? null,
  });
}

/**
 * 🗑️ DELETE /api/admin/tickets/[ticketId]
 * Annule la réservation : la place est libérée et le QR code n'est plus valable.
 */
export async function DELETE(_req: Request, context: Context) {
  const { ticketId } = await context.params;
  const access = await loadTicketForAdmin(ticketId);
  if ("response" in access) return access.response;

  await db.ticket.delete({ where: { id: ticketId } });
  return Response.json({ success: true });
}
