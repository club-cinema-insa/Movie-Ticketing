import { db } from "@/server/db";
import { eventAccessWhere } from "@/server/auth/access";
import { requireAdmin } from "@/server/auth/guards";
import { createEventSchema, firstIssue } from "@/server/events/schema";

/** GET /api/admin/events : séances accessibles à l'admin connecté, avec réservations et présents. */
export async function GET() {
  const admin = await requireAdmin();
  if ("response" in admin) return admin.response;

  const events = await db.event.findMany({
    where: eventAccessWhere(admin.userId),
    include: { _count: { select: { tickets: true } } },
    orderBy: { date: "asc" },
  });

  const checkedInCounts = await db.ticket.groupBy({
    by: ["eventId"],
    where: { eventId: { in: events.map((event) => event.id) }, checkedIn: true },
    _count: { _all: true },
  });
  const checkedInByEvent = new Map(checkedInCounts.map((entry) => [entry.eventId, entry._count._all]));

  return Response.json(
    events.map((event) => ({ ...event, checkedInCount: checkedInByEvent.get(event.id) ?? 0 })),
  );
}

/** POST /api/admin/events : crée une séance (brouillon par défaut). */
export async function POST(req: Request) {
  const admin = await requireAdmin();
  if ("response" in admin) return admin.response;

  const parsed = createEventSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: firstIssue(parsed.error) }, { status: 400 });
  }
  const { name, date, location, description, image, maxTickets, show } = parsed.data;

  const event = await db.event.create({
    data: {
      name,
      date,
      location,
      description,
      image,
      maxTickets,
      show: show === true,
      createdById: admin.userId,
    },
  });

  return Response.json(event);
}
