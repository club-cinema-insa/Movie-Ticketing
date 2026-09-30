import type { NextApiRequest, NextApiResponse } from "next";
import { db } from "@/server/db";
import { CANCEL_MESSAGES, cancelState, isValidCancelToken } from "@/server/tickets/cancel";

// Même forme que le code du QR code.
const TICKET_CODE_PATTERN = /^TICKET-[A-Z0-9]{8,16}$/;

/**
 * POST /api/tickets/[code]/cancel
 * Corps : { token } : l'étudiant annule lui-même sa réservation depuis le lien reçu par e-mail.
 * La place est libérée et le QR code n'est plus reconnu.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Méthode non autorisée." });
  }

  const { code } = req.query;
  if (typeof code !== "string" || !TICKET_CODE_PATTERN.test(code)) {
    return res.status(404).json({ error: "Réservation introuvable ou déjà annulée." });
  }

  const body = (req.body ?? {}) as { token?: unknown };
  if (!isValidCancelToken(code, body.token)) {
    return res.status(403).json({ error: "Ce lien d’annulation n’est pas valide." });
  }

  try {
    const ticket = await db.ticket.findUnique({ where: { code }, include: { event: true } });
    if (!ticket) {
      return res.status(404).json({ error: "Réservation introuvable ou déjà annulée." });
    }

    const state = cancelState(ticket, ticket.event);
    if (state !== "allowed") {
      return res.status(409).json({ error: CANCEL_MESSAGES[state] });
    }

    // Conditionnel : si le billet est scanné entre-temps, il n'est pas supprimé.
    const { count } = await db.ticket.deleteMany({ where: { id: ticket.id, checkedIn: false } });
    if (count === 0) {
      return res.status(409).json({ error: CANCEL_MESSAGES.used });
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Erreur lors de l'annulation du billet :", error);
    return res.status(500).json({ error: "Erreur serveur." });
  }
}
