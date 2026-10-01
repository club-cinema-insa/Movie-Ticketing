import { after } from "next/server";
import { db } from "@/server/db";
import { loadEventForAdmin } from "@/server/auth/guards";
import { firstIssue, updateEventSchema } from "@/server/events/schema";
import { announceSession, removeSession, syncSession } from "@/server/discord/sessions";

/** Champs que la séance Discord reprend : leur modification déclenche une mise à jour. */
const DISCORD_FIELDS = ["name", "date", "startOffsetMinutes", "location", "description"] as const;

type Context = { params: Promise<{ id: string }> };

/** GET /api/admin/events/[id] : la séance, avec le nombre de billets et de présents (formulaire de modification). */
export async function GET(_req: Request, context: Context) {
  const { id } = await context.params;
  const access = await loadEventForAdmin(id);
  if ("response" in access) return access.response;

  const [totalTickets, checkedInCount] = await Promise.all([
    db.ticket.count({ where: { eventId: id } }),
    db.ticket.count({ where: { eventId: id, checkedIn: true } }),
  ]);

  return Response.json({ ...access.event, totalTickets, checkedInCount });
}

/** PUT /api/admin/events/[id] : mise à jour partielle (nom, date, publication, etc.). */
export async function PUT(req: Request, context: Context) {
  const { id } = await context.params;
  const access = await loadEventForAdmin(id);
  if ("response" in access) return access.response;

  const parsed = updateEventSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: firstIssue(parsed.error) }, { status: 400 });
  }

  const updated = await db.event.update({ where: { id }, data: parsed.data });

  if (updated.show && !updated.announcedAt) {
    after(() => announceSession(id));
  } else if (updated.discordEventId && DISCORD_FIELDS.some((field) => parsed.data[field] !== undefined)) {
    after(() => syncSession(id));
  }

  return Response.json(updated);
}

/** DELETE /api/admin/events/[id] : supprime la séance et ses billets. */
export async function DELETE(_req: Request, context: Context) {
  const { id } = await context.params;
  const access = await loadEventForAdmin(id);
  if ("response" in access) return access.response;

  await db.$transaction([
    db.ticket.deleteMany({ where: { eventId: id } }),
    db.event.delete({ where: { id } }),
  ]);

  const { discordEventId } = access.event;
  if (discordEventId) after(() => removeSession(discordEventId));

  return Response.json({ success: true });
}
