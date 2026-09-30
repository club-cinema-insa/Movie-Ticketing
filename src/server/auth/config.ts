import { PrismaAdapter } from "@auth/prisma-adapter";
import type { NextAuthOptions } from "next-auth";
import DiscordProvider from "next-auth/providers/discord";
import { db } from "@/server/db";
import { env } from "@/env";
import { getInitialAdminDiscordIds } from "@/server/auth/access";

// Déclaration des types personnalisés pour NextAuth
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }

  interface User {
    id: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
  }
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(db),
  providers: [
    DiscordProvider({
      clientId: env.AUTH_DISCORD_ID,
      clientSecret: env.AUTH_DISCORD_SECRET,
    }),
  ],
  pages: {
    error: "/auth/error",
  },
  callbacks: {
    /**
     * Seuls les comptes Discord déjà connus (table User) ou listés dans
     * INITIAL_ADMIN_DISCORD_IDS peuvent se connecter. Ce callback s'exécute avant
     * toute écriture de l'adapter : refuser ici ne crée aucun utilisateur.
     */
    async signIn({ user, account }) {
      if (account?.provider !== "discord") return false;
      const discordId = account.providerAccountId;

      try {
        // Compte déjà lié : utilisateur connu, rien à faire.
        const linked = await db.account.findUnique({
          where: {
            provider_providerAccountId: {
              provider: "discord",
              providerAccountId: discordId,
            },
          },
        });
        if (linked) return true;

        // Première connexion : l'utilisateur doit avoir été autorisé au préalable.
        let dbUser = await db.user.findUnique({ where: { discordId } });

        if (!dbUser) {
          if (!getInitialAdminDiscordIds().includes(discordId)) return false;

          const emailTaken = user.email
            ? await db.user.findUnique({ where: { email: user.email } })
            : null;
          dbUser = await db.user.create({
            data: {
              discordId,
              name: user.name ?? null,
              image: user.image ?? null,
              email: emailTaken ? null : (user.email ?? null),
            },
          });
        } else if (!dbUser.name || !dbUser.image) {
          dbUser = await db.user.update({
            where: { id: dbUser.id },
            data: {
              name: dbUser.name ?? user.name ?? null,
              image: dbUser.image ?? user.image ?? null,
            },
          });
        }

        // On lie le compte Discord nous-mêmes pour éviter que NextAuth ne crée un doublon.
        await db.account.create({
          data: {
            userId: dbUser.id,
            type: account.type,
            provider: account.provider,
            providerAccountId: discordId,
            access_token: account.access_token ?? null,
            refresh_token: account.refresh_token ?? null,
            expires_at: account.expires_at ?? null,
            token_type: account.token_type ?? null,
            scope: account.scope ?? null,
            id_token: account.id_token ?? null,
            session_state: account.session_state ?? null,
          },
        });
        return true;
      } catch (error) {
        console.error("Erreur lors de la vérification de l'accès admin :", error);
        return false;
      }
    },
    async session({ session, user }) {
      // Injecte l'ID utilisateur dans la session
      if (session.user) {
        session.user.id = user.id;
      }
      return session;
    },
  },
  secret: env.AUTH_SECRET,
};
