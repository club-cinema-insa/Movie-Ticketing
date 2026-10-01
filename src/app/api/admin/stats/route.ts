import { db } from "@/server/db";
import { eventAccessWhere } from "@/server/auth/access";
import { requireAdmin } from "@/server/auth/guards";
import { computeStats } from "@/server/stats/compute";

const ALLOWED_MONTHS = [0, 3, 6, 12];

/** GET /api/admin/stats?months=0|3|6|12 : fréquentation des séances passées accessibles à l'admin. */
export async function GET(request: Request) {
  const admin = await requireAdmin();
  if ("response" in admin) return admin.response;

  const requested = Number(new URL(request.url).searchParams.get("months") ?? 0);
  const months = ALLOWED_MONTHS.includes(requested) ? requested : 0;

  const events = await db.event.findMany({
    where: eventAccessWhere(admin.userId),
    select: {
      id: true,
      name: true,
      date: true,
      maxTickets: true,
      tickets: { select: { participantId: true, checkedIn: true, createdAt: true } },
    },
  });

  return Response.json(computeStats(events, months));
}
