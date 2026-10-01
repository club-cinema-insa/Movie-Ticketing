import { timingSafeEqual } from "node:crypto";
import { env } from "@/env";
import { purgeExpiredPersonalData } from "@/server/privacy/purge";

function isAuthorized(request: Request): boolean {
  const secret = env.CRON_SECRET;
  if (!secret) return false;
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/**
 * GET /api/cron/purge : appelée chaque semaine par Vercel (voir vercel.json).
 * Vercel envoie automatiquement `Authorization: Bearer <CRON_SECRET>`.
 * `?dryRun=1` compte ce qui serait effacé sans rien modifier.
 */
export async function GET(request: Request) {
  if (!env.CRON_SECRET) {
    return Response.json({ error: "CRON_SECRET non configuré." }, { status: 503 });
  }
  if (!isAuthorized(request)) {
    return Response.json({ error: "Non autorisé" }, { status: 401 });
  }

  const dryRun = new URL(request.url).searchParams.get("dryRun") === "1";
  const report = await purgeExpiredPersonalData(new Date(), dryRun);
  console.log("Purge des données personnelles :", JSON.stringify(report));
  return Response.json(report);
}
