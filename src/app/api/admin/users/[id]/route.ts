import { getServerSession } from "next-auth/next";
import { authOptions } from "@/server/auth/config";
import { db } from "@/server/db";
import { recordAudit } from "@/server/audit/log";

/**
 * DELETE /api/admin/users/[id]
 * Retire l'accès d'un compte. Ses sessions sont supprimées en cascade : il est
 * déconnecté immédiatement.
 */
export async function DELETE(
  _req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return Response.json({ error: "Non autorisé" }, { status: 401 });
  }

  const { id } = await context.params;

  if (id === session.user.id) {
    return Response.json(
      { error: "Vous ne pouvez pas retirer votre propre accès." },
      { status: 400 },
    );
  }

  const user = await db.user.findUnique({
    where: { id },
    include: { _count: { select: { events: true } } },
  });
  if (!user) {
    return Response.json({ error: "Utilisateur introuvable" }, { status: 404 });
  }

  // Sans propriétaire, un événement ne pourrait plus être géré (createdById passe à NULL).
  if (user._count.events > 0) {
    return Response.json(
      {
        error: `Ce compte a créé ${user._count.events} séance${user._count.events > 1 ? "s" : ""}. Réattribuez-les avant de retirer son accès.`,
      },
      { status: 409 },
    );
  }

  await db.user.delete({ where: { id } });
  await recordAudit({
    actor: { userId: session.user.id, name: session.user.name ?? null },
    action: "access.remove",
    detail: user.name ?? user.discordId ?? "compte sans nom",
  });

  return Response.json({ success: true });
}
