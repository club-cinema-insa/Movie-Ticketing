import { after } from "next/server";
import { db } from "@/server/db";
import { loadEventForAdmin } from "@/server/auth/guards";
import { firstIssue, updateEventSchema } from "@/server/events/schema";
import { announceSession, removeSession, syncSession } from "@/server/discord/sessions";
import { recordAudit } from "@/server/audit/log";

/** Champs que la séance Discord reprend : leur modification déclenche une mise à jour. */
const DISCORD_FIELDS = ["name", "date", "startOffsetMinutes", "location", "description"] as const;

/** Champs suivis dans l'historique, avec leur libellé. */
const AUDITED_FIELDS = {
  name: "nom",
  date: "date",
  startOffsetMinutes: "heure de début",
  location: "lieu",
  description: "description",
  image: "affiche",
  maxTickets: "places",
  announceEmojis: "emojis de l’annonce",
} as const;

const sameValue = (a: unknown, b: unknown) =>
  a instanceof Date || b instanceof Date ? new Date(a as Date).getTime() === new Date(b as Date).getTime() : a === b;

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

  const changed = (Object.keys(AUDITED_FIELDS) as (keyof typeof AUDITED_FIELDS)[])
    .filter((field) => parsed.data[field] !== undefined && !sameValue(parsed.data[field], access.event[field]))
    .map((field) => AUDITED_FIELDS[field]);
  if (changed.length > 0) {
    await recordAudit({ actor: access, action: "event.update", event: updated, detail: changed.join(", ") });
  }
  if (parsed.data.show !== undefined && parsed.data.show !== access.event.show) {
    await recordAudit({ actor: access, action: parsed.data.show ? "event.publish" : "event.unpublish", event: updated });
  }

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

  const [{ count: removedTickets }] = await db.$transaction([
    db.ticket.deleteMany({ where: { eventId: id } }),
    db.event.delete({ where: { id } }),
  ]);
  await recordAudit({
    actor: access,
    action: "event.delete",
    event: access.event,
    detail: removedTickets > 0 ? `${removedTickets} réservation${removedTickets > 1 ? "s" : ""} supprimée${removedTickets > 1 ? "s" : ""}` : null,
  });

  const { discordEventId } = access.event;
  if (discordEventId) after(() => removeSession(discordEventId));

  return Response.json({ success: true });
}
