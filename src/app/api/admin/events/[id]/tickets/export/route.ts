import { db } from "@/server/db";
import { loadEventForAdmin } from "@/server/auth/guards";
import { EVENT_TIME_ZONE } from "@/lib/format";

type Context = { params: Promise<{ id: string }> };


const formatDateTime = (date: Date | null) =>
  date
    ? date.toLocaleString("fr-FR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: EVENT_TIME_ZONE,
      })
    : "";

/**
 * Cellule CSV : guillemets échappés, et neutralisation des formules (=, +, -, @) que
 * Excel exécuterait à l'ouverture d'un fichier contenant un nom saisi par un inscrit.
 */
const cell = (value: string | number | null | undefined) => {
  let text = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
};

const fileSlug = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 50) || "seance";

/**
 * GET /api/admin/events/[id]/tickets/export
 * Liste des inscrits au format CSV (séparateur « ; » et BOM UTF-8 pour Excel en français).
 */
export async function GET(_req: Request, context: Context) {
  const { id } = await context.params;
  const access = await loadEventForAdmin(id);
  if ("response" in access) return access.response;
  const { event } = access;

  const tickets = await db.ticket.findMany({
    where: { eventId: id },
    include: { participant: { select: { name: true, email: true } } },
    orderBy: [{ number: "asc" }, { createdAt: "asc" }],
  });

  const header = ["Numéro", "Nom", "Email", "Code", "Inscrit le", "Présent", "Validé le"];
  const rows = tickets.map((ticket) => [
    ticket.number,
    ticket.participant.name,
    ticket.participant.email,
    ticket.code,
    formatDateTime(ticket.createdAt),
    ticket.checkedIn ? "oui" : "non",
    formatDateTime(ticket.redeemedAt),
  ]);

  const csv =
    "﻿" +
    [header, ...rows].map((row) => row.map(cell).join(";")).join("\r\n") +
    "\r\n";

  const day = event.date.toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="inscrits_${fileSlug(event.name)}_${day}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
