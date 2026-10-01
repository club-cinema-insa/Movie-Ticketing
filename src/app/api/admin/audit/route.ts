import type { Prisma } from "@prisma/client";
import { db } from "@/server/db";
import { sharedEventsEnabled } from "@/server/auth/access";
import { requireAdmin } from "@/server/auth/guards";

const PAGE_SIZE = 40;
const CATEGORY_PREFIX: Record<string, string> = { events: "event.", tickets: "ticket.", access: "access." };

/**
 * GET /api/admin/audit?category=events|tickets|access&eventId=…&cursor=…
 * Historique des actions du bureau, du plus récent au plus ancien.
 * Sans partage des séances entre admins, on ne voit que ses propres actions et ce qui touche ses séances.
 */
export async function GET(request: Request) {
  const admin = await requireAdmin();
  if ("response" in admin) return admin.response;

  const params = new URL(request.url).searchParams;
  const category = params.get("category");
  const eventId = params.get("eventId");
  const cursor = params.get("cursor");

  const where: Prisma.AuditLogWhereInput = {};
  if (category && CATEGORY_PREFIX[category]) where.action = { startsWith: CATEGORY_PREFIX[category] };
  if (eventId) where.eventId = eventId;

  if (!sharedEventsEnabled()) {
    const mine = await db.event.findMany({ where: { createdById: admin.userId }, select: { id: true } });
    where.AND = [{ OR: [{ actorId: admin.userId }, { eventId: { in: mine.map((event) => event.id) } }] }];
  }

  const rows = await db.auditLog.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: PAGE_SIZE + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const hasMore = rows.length > PAGE_SIZE;
  const entries = rows.slice(0, PAGE_SIZE);

  return Response.json({
    entries: entries.map(({ id, createdAt, action, actorName, eventId: entryEventId, eventName, detail }) => ({
      id,
      createdAt,
      action,
      actorName,
      eventId: entryEventId,
      eventName,
      detail,
    })),
    nextCursor: hasMore ? entries[entries.length - 1]?.id : null,
  });
}
