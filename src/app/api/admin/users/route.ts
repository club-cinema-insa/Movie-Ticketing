import { getServerSession } from "next-auth/next";
import { authOptions } from "@/server/auth/config";
import { db } from "@/server/db";
import { isValidDiscordId } from "@/server/auth/access";

/**
 * 👥 GET /api/admin/users
 * Liste des comptes autorisés à se connecter à l'espace admin.
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return Response.json({ error: "Non autorisé" }, { status: 401 });
  }

  const users = await db.user.findMany({
    include: {
      accounts: {
        where: { provider: "discord" },
        select: { providerAccountId: true },
      },
      _count: { select: { events: true } },
    },
    orderBy: { name: "asc" },
  });

  return Response.json(
    users.map((user) => ({
      id: user.id,
      name: user.name,
      image: user.image,
      discordId: user.discordId ?? user.accounts[0]?.providerAccountId ?? null,
      hasLoggedIn: user.accounts.length > 0,
      eventsCount: user._count.events,
      isSelf: user.id === session.user.id,
    })),
  );
}

/**
 * ➕ POST /api/admin/users
 * Autorise un compte Discord (par son identifiant) à se connecter.
 */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return Response.json({ error: "Non autorisé" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as {
    discordId?: unknown;
    name?: unknown;
  } | null;

  const discordId =
    typeof body?.discordId === "string" ? body.discordId.trim() : "";
  const name = typeof body?.name === "string" ? body.name.trim() : "";

  if (!isValidDiscordId(discordId)) {
    return Response.json(
      {
        error:
          "Identifiant Discord invalide (17 à 20 chiffres, à copier depuis Discord en mode développeur).",
      },
      { status: 400 },
    );
  }
  if (name.length > 100) {
    return Response.json({ error: "Nom trop long." }, { status: 400 });
  }

  const existing = await db.user.findFirst({
    where: {
      OR: [
        { discordId },
        { accounts: { some: { provider: "discord", providerAccountId: discordId } } },
      ],
    },
  });
  if (existing) {
    return Response.json(
      { error: "Ce compte Discord est déjà autorisé." },
      { status: 409 },
    );
  }

  const user = await db.user.create({
    data: { discordId, name: name || null },
  });

  return Response.json({ id: user.id }, { status: 201 });
}
