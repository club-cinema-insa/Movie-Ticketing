import { getServerSession } from "next-auth/next";
import { authOptions } from "@/server/auth/config";
import { db } from "@/server/db";
import { canAccessEvent } from "@/server/auth/access";

type UpdateBody = {
  name?: string;
  date?: string | Date;
  location?: string;
  description?: string;
  logoUrl?: string;
  image?: string;
  maxTickets?: string | number | null;
  show?: boolean;
};

type ParamsContext =
  | { params: { id: string } }
  | { params: Promise<{ id: string }> };

// Helper pour gérer le cas params ou Promise<params>
async function getIdFromContext(ctx: ParamsContext): Promise<string> {
  const p = (ctx as any).params;
  return typeof p.then === "function" ? (await p).id : p.id;
}

/**
 * 🔍 GET /api/admin/events/[id]
 * Récupérer un événement (pour pré-remplir le formulaire d’édition)
 */
export async function GET(_req: Request, context: ParamsContext) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return Response.json({ error: "Non autorisé" }, { status: 401 });
  }

  const id = await getIdFromContext(context);

  const event = await db.event.findUnique({ where: { id } });

  if (!event) {
    return Response.json({ error: "Événement introuvable" }, { status: 404 });
  }

  if (!canAccessEvent(event, session.user.id)) {
    return Response.json({ error: "Accès refusé" }, { status: 403 });
  }

  const [totalTickets, checkedInCount] = await Promise.all([
    db.ticket.count({ where: { eventId: id } }),
    db.ticket.count({ where: { eventId: id, checkedIn: true } }),
  ]);

  return Response.json({
    ...event,
    totalTickets,
    checkedInCount,
  });
}

/**
 * ✏️ PUT /api/admin/events/[id]
 * Mettre à jour un événement (partiellement : nom, date, show, etc.)
 */
export async function PUT(req: Request, context: ParamsContext) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return Response.json({ error: "Non autorisé" }, { status: 401 });
  }

  const id = await getIdFromContext(context);
  const body: UpdateBody = await req.json();

  const event = await db.event.findUnique({ where: { id } });
  if (!event) {
    return Response.json({ error: "Événement introuvable" }, { status: 404 });
  }
  if (!canAccessEvent(event, session.user.id)) {
    return Response.json({ error: "Accès refusé" }, { status: 403 });
  }

  const data: Record<string, unknown> = {};

  if (body.name !== undefined) data.name = body.name;
  if (body.location !== undefined) data.location = body.location;
  if (body.description !== undefined) data.description = body.description;
  if (body.logoUrl !== undefined) data.logoUrl = body.logoUrl;
  if (body.image !== undefined) data.image = body.image;

  if (body.maxTickets !== undefined) {
    data.maxTickets =
      body.maxTickets === null
        ? null
        : typeof body.maxTickets === "string"
        ? parseInt(body.maxTickets, 10)
        : body.maxTickets;
  }

  if (body.date !== undefined) {
    const d = new Date(body.date);
    if (!Number.isNaN(d.getTime())) {
      data.date = d;
    }
  }

  if (body.show !== undefined) {
    data.show = !!body.show;
  }

  const updated = await db.event.update({
    where: { id },
    data,
  });

  return Response.json(updated);
}

/**
 * 🗑️ DELETE /api/admin/events/[id]
 * Supprimer un événement
 */
export async function DELETE(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return Response.json({ error: "Non autorisé" }, { status: 401 });
  }

  const { id } = await context.params;

  const event = await db.event.findUnique({ where: { id } });

  if (!event) {
    return Response.json(
      { error: "Événement introuvable" },
      { status: 404 },
    );
  }

  if (!canAccessEvent(event, session.user.id)) {
    return Response.json({ error: "Accès refusé" }, { status: 403 });
  }

  // Supprime tous les tickets liés
  await db.ticket.deleteMany({
    where: { eventId: id },
  });

  // Supprime l'événement
  await db.event.delete({
    where: { id },
  });

  return Response.json({ success: true });
}
