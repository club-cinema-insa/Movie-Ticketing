import { createHmac, timingSafeEqual } from "node:crypto";
import type { Event, Ticket } from "@prisma/client";
import { env } from "@/env";

/**
 * Jeton d'annulation d'un billet : signature du code avec le secret de l'application.
 * Il n'est stocké nulle part ; il figure dans l'e-mail et sur la page de confirmation.
 * Il est distinct du QR code : photographier le billet de quelqu'un ne permet pas de l'annuler.
 */
export function cancelToken(code: string): string {
  const secret = env.AUTH_SECRET ?? "dev-only-secret";
  return createHmac("sha256", secret).update(`cancel:${code}`).digest("base64url").slice(0, 32);
}

export function isValidCancelToken(code: string, token: unknown): boolean {
  if (typeof token !== "string") return false;
  const expected = Buffer.from(cancelToken(code));
  const given = Buffer.from(token);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/** Lien de la page du billet, avec le droit d'annuler. */
export function manageTicketPath(code: string): string {
  return `/billet/${code}?t=${cancelToken(code)}`;
}

export type CancelState = "allowed" | "used" | "closed";

/** L'étudiant peut annuler tant que le billet n'a pas servi et que les portes ne sont pas ouvertes. */
export function cancelState(ticket: Pick<Ticket, "checkedIn">, event: Pick<Event, "date">, now = new Date()): CancelState {
  if (ticket.checkedIn) return "used";
  if (now.getTime() >= event.date.getTime()) return "closed";
  return "allowed";
}

export const CANCEL_MESSAGES: Record<Exclude<CancelState, "allowed">, string> = {
  used: "Ce billet a déjà été utilisé : il ne peut plus être annulé.",
  closed: "Les annulations sont closes : la séance a commencé.",
};
