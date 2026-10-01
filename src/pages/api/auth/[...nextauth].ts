import type { NextApiRequest, NextApiResponse } from "next";
import NextAuth from "next-auth";
import { env } from "@/env";
import { authOptions } from "@/server/auth/config";

/**
 * Connexion Discord.
 *
 * Derrière un relais (Netlify) pour les réseaux qui bloquent vercel.app, le site reçoit les requêtes
 * avec l'adresse de Vercel : NextAuth enverrait alors Discord rappeler une adresse bloquée.
 * AUTH_PUBLIC_URL impose l'adresse publique à utiliser pour la connexion. Sans elle, NextAuth
 * déduit l'adresse de la requête, comme avant.
 */
export default async function auth(req: NextApiRequest, res: NextApiResponse) {
  if (env.AUTH_PUBLIC_URL) {
    const publicUrl = new URL(env.AUTH_PUBLIC_URL);
    req.headers["x-forwarded-host"] = publicUrl.host;
    req.headers["x-forwarded-proto"] = publicUrl.protocol.replace(":", "");
  }
  await NextAuth(req, res, authOptions);
}
