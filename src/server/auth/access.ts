import { env } from "@/env";

/** Identifiants Discord autorisés par configuration (amorçage d'une installation). */
export function getInitialAdminDiscordIds(): string[] {
  return (env.INITIAL_ADMIN_DISCORD_IDS ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}

/** Un identifiant Discord est un entier (snowflake) de 17 à 20 chiffres. */
export function isValidDiscordId(value: string): boolean {
  return /^\d{17,20}$/.test(value);
}

/** true : tous les admins autorisés gèrent tous les événements. */
export function sharedEventsEnabled(): boolean {
  return env.ADMIN_SHARED_EVENTS === "true";
}

/** Filtre Prisma des événements accessibles à l'utilisateur donné. */
export function eventAccessWhere(userId: string): { createdById?: string } {
  return sharedEventsEnabled() ? {} : { createdById: userId };
}

/** Vérifie côté serveur que l'utilisateur peut gérer l'événement. */
export function canAccessEvent(
  event: { createdById: string | null },
  userId: string,
): boolean {
  return sharedEventsEnabled() || event.createdById === userId;
}
