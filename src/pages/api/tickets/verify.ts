import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/server/auth/config";
import { db } from "@/server/db";
import { canAccessEvent } from "@/server/auth/access";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Méthode non autorisée." });
  }

  // Vérifie la session utilisateur
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) {
    return res.status(401).json({ error: "Non autorisé. Veuillez vous connecter." });
  }

  const { code } = req.body;

  if (!code) {
    return res.status(400).json({ error: "Code du ticket manquant." });
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
        message: "Ticket introuvable.",
      });
    }

    // Vérifie que l'utilisateur connecté peut gérer cet événement (créateur, ou tous les admins si le partage est activé)
    if (!canAccessEvent(ticket.event, session.user.id)) {
      return res.status(403).json({
        valid: false,
        message: "⛔ Vous n’êtes pas autorisé à vérifier ce ticket.",
      });
    }

    // Si déjà scanné
    if (ticket.checkedIn) {
      return res.status(200).json({
        valid: false,
        message: `🚫 Ticket déjà validé le ${new Date(ticket.redeemedAt!).toLocaleString("fr-FR")}.`,
        ticket: {
          code: ticket.code,
          participant: ticket.participant,
          event: ticket.event,
          redeemedAt: ticket.redeemedAt,
        },
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
      return res.status(200).json({
        valid: false,
        message: `🚫 Ticket déjà validé le ${new Date(current?.redeemedAt ?? redeemedAt).toLocaleString("fr-FR")}.`,
        ticket: {
          code: ticket.code,
          participant: ticket.participant,
          event: ticket.event,
          redeemedAt: current?.redeemedAt ?? null,
        },
      });
    }

    const updatedTicket = { ...ticket, redeemedAt };

    return res.status(200).json({
      valid: true,
      message: `✅ Ticket valide pour ${updatedTicket.participant.name} (${updatedTicket.event.name}).`,
      ticket: {
        code: updatedTicket.code,
        participant: updatedTicket.participant,
        event: updatedTicket.event,
        redeemedAt: updatedTicket.redeemedAt,
      },
    });
  } catch (error) {
    console.error("Erreur de vérification du ticket :", error);
    return res.status(500).json({ error: "Erreur serveur." });
  }
}
