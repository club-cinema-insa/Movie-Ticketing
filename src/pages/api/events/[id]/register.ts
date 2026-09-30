import { randomBytes } from "crypto";
import type { NextApiRequest, NextApiResponse } from "next";
import nodemailer from "nodemailer";
import type { Event, Participant, Ticket } from "@prisma/client";
import { db } from "@/server/db";
import { generateQRCode } from "@/server/utils/ticket";
import { generateTicketPDF } from "@/server/utils/generateTicketPDF";
import { branding } from "@/config/branding";

const EVENT_TIME_ZONE = process.env.EVENT_TIME_ZONE ?? "Europe/Paris";

const MAX_NAME_LENGTH = 100;
const MAX_EMAIL_LENGTH = 254;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const formatDate = (date: Date) =>
  date.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: EVENT_TIME_ZONE,
  });

const formatTime = (date: Date) =>
  date.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: EVENT_TIME_ZONE,
  });

const buildEmailSignature = () =>
  branding.emailSignature
    ? `<div style="margin-top:24px;font-size:14px;color:#475569;">${escapeHtml(branding.emailSignature)}</div>`
    : "";

/** Code de billet imprévisible : il donne accès à la salle. */
const generateTicketCode = () =>
  `TICKET-${randomBytes(6).toString("hex").toUpperCase()}`;

type CreateResult =
  | { kind: "existing"; ticket: Ticket }
  | { kind: "created"; ticket: Ticket }
  | { kind: "hidden" }
  | { kind: "full" };

/**
 * Crée le billet de façon atomique : un verrou par projection sérialise les
 * inscriptions simultanées, ce qui garantit la capacité maximale, la numérotation
 * et l'unicité d'un billet par participant.
 */
async function findOrCreateTicket(
  event: Event,
  participant: Participant,
): Promise<CreateResult> {
  const code = generateTicketCode();
  const qrCode = await generateQRCode(code);

  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${event.id}))`;

    // Un billet existant est toujours renvoyé, même si la projection est complète.
    const existing = await tx.ticket.findFirst({
      where: { eventId: event.id, participantId: participant.id },
      orderBy: { createdAt: "asc" },
    });
    if (existing) return { kind: "existing", ticket: existing };

    // Pas de nouvelle inscription sur une projection non publiée.
    if (!event.show) return { kind: "hidden" };

    const issued = await tx.ticket.count({ where: { eventId: event.id } });
    if (event.maxTickets && issued >= event.maxTickets) return { kind: "full" };

    const last = await tx.ticket.aggregate({
      where: { eventId: event.id },
      _max: { number: true },
    });

    const ticket = await tx.ticket.create({
      data: {
        code,
        number: (last._max.number ?? 0) + 1,
        qrCode,
        eventId: event.id,
        participantId: participant.id,
      },
    });
    return { kind: "created", ticket };
  });
}

/** Envoie le billet par email. Ne lève jamais d'exception : une panne SMTP n'annule pas la réservation. */
async function sendTicketEmail(params: {
  participant: Participant;
  event: Event;
  ticket: Ticket;
  pdf: Buffer;
  reused: boolean;
}): Promise<boolean> {
  const { participant, event, ticket, pdf, reused } = params;

  if (process.env.EMAIL_DISABLED === "true") {
    console.log(`📮 Envoi d'e-mail désactivé (EMAIL_DISABLED=true), destinataire : ${participant.email}`);
    return false;
  }
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn("📮 SMTP non configuré : e-mail non envoyé.");
    return false;
  }

  try {
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
      from: `"${branding.appShortName}" <${process.env.SMTP_USER}>`,
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
        <p>📅 ${escapeHtml(formatDate(event.date))} à ${escapeHtml(formatTime(event.date))}<br />
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
  const body = (req.body ?? {}) as { name?: unknown; email?: unknown };

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";

  if (!eventId || typeof eventId !== "string" || !name || !email) {
    return res.status(400).json({ error: "Données manquantes." });
  }
  if (name.length > MAX_NAME_LENGTH) {
    return res.status(400).json({ error: "Le nom est trop long." });
  }
  if (email.length > MAX_EMAIL_LENGTH || !EMAIL_PATTERN.test(email)) {
    return res.status(400).json({ error: "Adresse email invalide." });
  }

  try {
    const event = await db.event.findUnique({ where: { id: eventId } });
    if (!event) {
      return res.status(404).json({ error: "Événement introuvable." });
    }

    // Participant identifié par son email, sans tenir compte de la casse.
    let participant = await db.participant.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
    });
    if (!participant) {
      try {
        participant = await db.participant.create({ data: { name, email } });
      } catch {
        // Inscription simultanée avec le même email : on récupère le participant créé entre-temps.
        participant = await db.participant.findFirst({
          where: { email: { equals: email, mode: "insensitive" } },
        });
        if (!participant) throw new Error("Impossible de créer le participant.");
      }
    }

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

    const pdf = await generateTicketPDF({
      participantName: participant.name,
      eventName: event.name,
      dateLabel: formatDate(event.date),
      timeLabel: formatTime(event.date),
      location: event.location ?? "Lieu à venir",
      code: ticket.code,
      qrCodeDataUrl: ticket.qrCode,
      ticketNumber: ticket.number ?? undefined,
      maxTickets: event.maxTickets ?? undefined,
      posterUrl: event.image,
      info: event.description,
    });

    const emailSent = await sendTicketEmail({ participant, event, ticket, pdf, reused });

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
      pdfBase64: pdf.toString("base64"),
    });
  } catch (error) {
    console.error("❌ Erreur lors de la création / récupération du ticket :", error);
    return res.status(500).json({ error: "Erreur serveur." });
  }
}
