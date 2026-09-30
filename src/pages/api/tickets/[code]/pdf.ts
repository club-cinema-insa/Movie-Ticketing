import type { NextApiRequest, NextApiResponse } from "next";
import { db } from "@/server/db";
import { buildTicketPDF, ticketFileName } from "@/server/utils/ticketDocument";

// Le code du billet est celui du QR code : imprévisible, il fait office de secret.
const TICKET_CODE_PATTERN = /^TICKET-[A-Z0-9]{8,16}$/;

/**
 * GET /api/tickets/[code]/pdf
 * Génère le PDF du billet à la demande (l'inscription ne le renvoie plus, pour rester rapide).
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Méthode non autorisée." });
  }

  const { code } = req.query;
  if (typeof code !== "string" || !TICKET_CODE_PATTERN.test(code)) {
    return res.status(404).json({ error: "Billet introuvable." });
  }

  try {
    const ticket = await db.ticket.findUnique({
      where: { code },
      include: { event: true, participant: true },
    });
    if (!ticket) {
      return res.status(404).json({ error: "Billet introuvable." });
    }

    const pdf = await buildTicketPDF({
      ticket,
      event: ticket.event,
      participant: ticket.participant,
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${ticketFileName(ticket.event.name)}"`,
    );
    res.setHeader("Content-Length", String(pdf.length));
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("X-Robots-Tag", "noindex");
    return res.status(200).send(pdf);
  } catch (error) {
    console.error("❌ Erreur lors de la génération du PDF :", error);
    return res.status(500).json({ error: "Erreur serveur." });
  }
}
