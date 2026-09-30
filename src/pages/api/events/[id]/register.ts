import type { NextApiRequest, NextApiResponse } from "next";
import nodemailer from "nodemailer";
import type { Event, Participant, Ticket } from "@prisma/client";
import { db } from "@/server/db";
import {
  findOrCreateParticipant,
  findOrCreateTicket,
  parseRegistration,
} from "@/server/tickets/issue";
import {
  buildTicketPDF,
  formatDate,
  formatTime,
  startAfterDoors,
} from "@/server/utils/ticketDocument";
import { branding } from "@/config/branding";

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const buildEmailSignature = () =>
  branding.emailSignature
    ? `<div style="margin-top:24px;font-size:14px;color:#475569;">${escapeHtml(branding.emailSignature)}</div>`
    : "";

/** Envoie le billet par email. Ne lève jamais d'exception : une panne SMTP n'annule pas la réservation. */
async function sendTicketEmail(params: {
  participant: Participant;
  event: Event;
  ticket: Ticket;
  reused: boolean;
}): Promise<boolean> {
  const { participant, event, ticket, reused } = params;

  if (process.env.EMAIL_DISABLED === "true") {
    console.log(`📮 Envoi d'e-mail désactivé (EMAIL_DISABLED=true), destinataire : ${participant.email}`);
    return false;
  }
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn("📮 SMTP non configuré : e-mail non envoyé.");
    return false;
  }

  try {
    // Le PDF n'est généré que lorsqu'un e-mail part réellement : l'inscription reste rapide.
    const pdf = await buildTicketPDF({ ticket, event, participant });

    const port = Number(process.env.SMTP_PORT ?? 587);
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      connectionTimeout: 8000,
      greetingTimeout: 8000,
      socketTimeout: 10000,
    });

    const eventName = escapeHtml(event.name);
    await transporter.sendMail({
      // SMTP_FROM : adresse d'expéditeur, distincte de l'identifiant SMTP chez la plupart des services.
      from: `"${branding.appShortName}" <${process.env.SMTP_FROM ?? process.env.SMTP_USER}>`,
      to: participant.email,
      subject: `🎟️ Votre billet pour ${event.name}`,
      html: `
        <h1>🎟️ Votre billet pour ${eventName}</h1>
        <p>Bonjour <strong>${escapeHtml(participant.name)}</strong>,</p>
        <p>${
          reused
            ? "Vous aviez déjà une inscription pour cette projection. Voici à nouveau votre billet en pièce jointe."
            : "Merci pour votre inscription. Vous trouverez votre billet en pièce jointe au format PDF."
        }</p>
        <p>📅 ${escapeHtml(formatDate(event.date))}<br />
        ${
          startAfterDoors(event.date)
            ? `🚪 Ouverture des portes à ${escapeHtml(formatTime(event.date))}<br />🎬 ${escapeHtml(branding.startLabel ?? "Début")} à ${escapeHtml(formatTime(startAfterDoors(event.date) as Date))}<br />`
            : `🕒 ${escapeHtml(formatTime(event.date))}<br />`
        }
        📍 ${escapeHtml(event.location ?? "Lieu à venir")}</p>
        ${buildEmailSignature()}
      `,
      attachments: [
        { filename: `${ticket.code}.pdf`, content: pdf, contentType: "application/pdf" },
      ],
    });
    return true;
  } catch (error) {
    console.error("📮 Échec de l'envoi de l'e-mail (la réservation est conservée) :", error);
    return false;
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Méthode non autorisée." });
  }

  const { id: eventId } = req.query;
  const parsed = parseRegistration((req.body ?? {}) as { name?: unknown; email?: unknown });

  if (!eventId || typeof eventId !== "string") {
    return res.status(400).json({ error: "Données manquantes." });
  }
  if (!parsed.ok) {
    return res.status(400).json({ error: parsed.error });
  }

  try {
    const event = await db.event.findUnique({ where: { id: eventId } });
    if (!event) {
      return res.status(404).json({ error: "Événement introuvable." });
    }

    const participant = await findOrCreateParticipant(parsed.name, parsed.email);

    const result = await findOrCreateTicket(event, participant);

    if (result.kind === "hidden") {
      return res.status(404).json({ error: "Événement introuvable." });
    }

    if (result.kind === "full") {
      return res.status(400).json({
        error: "Le nombre maximum de billets pour cet événement est atteint.",
      });
    }

    const { ticket } = result;
    const reused = result.kind === "existing";

    const emailSent = await sendTicketEmail({ participant, event, ticket, reused });

    return res.status(200).json({
      success: true,
      reused,
      emailSent,
      ticket: {
        id: ticket.id,
        code: ticket.code,
        number: ticket.number,
        qrCode: ticket.qrCode,
        eventName: event.name,
        eventLogoUrl: event.logoUrl ?? "",
        eventDescription: event.description ?? "",
        participantName: participant.name,
        participantEmail: participant.email,
      },
      // Le PDF est généré à la demande (l'inscription ne le renvoie plus).
      pdfUrl: `/api/tickets/${ticket.code}/pdf`,
    });
  } catch (error) {
    console.error("❌ Erreur lors de la création / récupération du ticket :", error);
    return res.status(500).json({ error: "Erreur serveur." });
  }
}
