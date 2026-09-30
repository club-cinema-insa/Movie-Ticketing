import { randomBytes } from "crypto";
import type { Event, Participant, Ticket } from "@prisma/client";
import { db } from "@/server/db";
import { generateQRCode } from "@/server/utils/ticket";

const MAX_NAME_LENGTH = 100;
const MAX_EMAIL_LENGTH = 254;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type ParsedRegistration =
  | { ok: true; name: string; email: string }
  | { ok: false; error: string };

/** Valide et normalise nom / email (email insensible à la casse et aux espaces). */
export function parseRegistration(input: { name?: unknown; email?: unknown }): ParsedRegistration {
  const name = typeof input.name === "string" ? input.name.trim() : "";
  const email = typeof input.email === "string" ? input.email.trim().toLowerCase() : "";

  if (!name || !email) return { ok: false, error: "Données manquantes." };
  if (name.length > MAX_NAME_LENGTH) return { ok: false, error: "Le nom est trop long." };
  if (email.length > MAX_EMAIL_LENGTH || !EMAIL_PATTERN.test(email)) {
    return { ok: false, error: "Adresse email invalide." };
  }
  return { ok: true, name, email };
}

/** Participant identifié par son email, sans tenir compte de la casse. */
export async function findOrCreateParticipant(name: string, email: string): Promise<Participant> {
  const find = () =>
    db.participant.findFirst({ where: { email: { equals: email, mode: "insensitive" } } });

  const existing = await find();
  if (existing) return existing;

  try {
    return await db.participant.create({ data: { name, email } });
  } catch {
    // Inscription simultanée avec le même email : on récupère le participant créé entre-temps.
    const created = await find();
    if (!created) throw new Error("Impossible de créer le participant.");
    return created;
  }
}

/** Code de billet imprévisible : il donne accès à la salle. */
const generateTicketCode = () => `TICKET-${randomBytes(6).toString("hex").toUpperCase()}`;

export type IssueResult =
  | { kind: "existing"; ticket: Ticket }
  | { kind: "created"; ticket: Ticket }
  | { kind: "hidden" }
  | { kind: "full" };

/**
 * Attribue un billet de façon atomique : un verrou par projection sérialise les
 * inscriptions simultanées, ce qui garantit la capacité maximale, la numérotation
 * et l'unicité d'un billet par participant.
 *
 * `admin` : ajout manuel par le bureau, qui peut dépasser la capacité (placement
 * exceptionnel) et inscrire quelqu'un sur une projection non publiée.
 */
export async function findOrCreateTicket(
  event: Event,
  participant: Participant,
  options: { admin?: boolean } = {},
): Promise<IssueResult> {
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

    // Pas de nouvelle inscription publique sur une projection non publiée.
    if (!event.show && !options.admin) return { kind: "hidden" };

    if (!options.admin) {
      const issued = await tx.ticket.count({ where: { eventId: event.id } });
      if (event.maxTickets && issued >= event.maxTickets) return { kind: "full" };
    }

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
