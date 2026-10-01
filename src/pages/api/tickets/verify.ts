import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/server/auth/config";
import { db } from "@/server/db";
import { canAccessEvent } from "@/server/auth/access";
import { EVENT_TIME_ZONE } from "@/lib/format";


const formatDateTime = (date: Date) =>
  date.toLocaleString("fr-FR", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: EVENT_TIME_ZONE,
  });

/**
 * POST /api/tickets/verify
 * Corps : { code: string, eventId?: string }
 *
 * `eventId` est la séance contrôlée : un billet d'une autre projection est refusé
 * sans être validé. `reason` permet à l'interface d'afficher un retour explicite.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Méthode non autorisée." });
  }

  // Vérifie la session utilisateur
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) {
    return res.status(401).json({ error: "Non autorisé. Veuillez vous connecter." });
  }

  const body = (req.body ?? {}) as { code?: unknown; eventId?: unknown };
  const code = typeof body.code === "string" ? body.code.trim().toUpperCase() : "";
  const expectedEventId =
    typeof body.eventId === "string" && body.eventId ? body.eventId : null;

  if (!code) {
    return res.status(400).json({ error: "Code du billet manquant." });
  }

  try {
    // Récupère le ticket + participant + événement
    const ticket = await db.ticket.findUnique({
      where: { code },
      include: {
        participant: true,
        event: true,
      },
    });

    if (!ticket) {
      return res.status(404).json({
        valid: false,
        reason: "not_found",
        message: "Billet introuvable.",
      });
    }

    // Vérifie que l'utilisateur connecté peut gérer cet événement (créateur, ou tous les admins si le partage est activé)
    if (!canAccessEvent(ticket.event, session.user.id)) {
      return res.status(403).json({
        valid: false,
        reason: "forbidden",
        message: "Vous n’êtes pas autorisé à contrôler ce billet.",
      });
    }

    const ticketInfo = {
      code: ticket.code,
      number: ticket.number,
      participant: ticket.participant,
      event: ticket.event,
      redeemedAt: ticket.redeemedAt,
    };

    // Billet d'une autre projection : refusé, non validé.
    if (expectedEventId && ticket.eventId !== expectedEventId) {
      return res.status(200).json({
        valid: false,
        reason: "wrong_event",
        message: `Ce billet est pour « ${ticket.event.name} » (${formatDateTime(ticket.event.date)}), pas pour cette séance.`,
        ticket: ticketInfo,
      });
    }

    // Si déjà scanné
    if (ticket.checkedIn) {
      return res.status(200).json({
        valid: false,
        reason: "already_used",
        message: `Billet déjà validé le ${formatDateTime(ticket.redeemedAt ?? new Date())}.`,
        ticket: ticketInfo,
      });
    }

    // Marque le ticket comme validé de façon atomique : deux scans simultanés
    // ne peuvent pas valider le même billet.
    const redeemedAt = new Date();
    const { count } = await db.ticket.updateMany({
      where: { id: ticket.id, checkedIn: false },
      data: { checkedIn: true, redeemedAt },
    });

    if (count === 0) {
      const current = await db.ticket.findUnique({ where: { id: ticket.id } });
      const usedAt = current?.redeemedAt ?? redeemedAt;
      return res.status(200).json({
        valid: false,
        reason: "already_used",
        message: `Billet déjà validé le ${formatDateTime(usedAt)}.`,
        ticket: { ...ticketInfo, redeemedAt: usedAt },
      });
    }

    return res.status(200).json({
      valid: true,
      reason: "valid",
      message: `Billet valide pour ${ticket.participant.name} (${ticket.event.name}).`,
      ticket: { ...ticketInfo, redeemedAt },
    });
  } catch (error) {
    console.error("Erreur de vérification du billet :", error);
    return res.status(500).json({ error: "Erreur serveur." });
  }
}
