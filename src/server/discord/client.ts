import { env } from "@/env";

const API_BASE = env.DISCORD_API_BASE ?? "https://discord.com/api/v10";
const TIMEOUT_MS = 8000;

export class DiscordError extends Error {
  constructor(
    readonly status: number,
    readonly detail: string,
  ) {
    super(`Discord ${status} : ${detail.slice(0, 200)}`);
  }
}

/** Bot configuré : sans jeton ni serveur, toutes les fonctions Discord sont désactivées. */
export function discordConfigured(): boolean {
  return Boolean(env.DISCORD_BOT_TOKEN && env.DISCORD_GUILD_ID);
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T | null> {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bot ${env.DISCORD_BOT_TOKEN ?? ""}`,
      "Content-Type": "application/json",
      "User-Agent": "DiscordBot (club-cine-billetterie, 1.0)",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new DiscordError(res.status, await res.text().catch(() => ""));
  return res.status === 204 ? null : ((await res.json()) as T);
}

export type ScheduledEventPayload = {
  name: string;
  description?: string;
  scheduled_start_time: string;
  scheduled_end_time: string;
  location: string;
  /** Data URL (PNG, JPEG ou GIF) de l'image de couverture. */
  image?: string;
};

const toDiscordEvent = ({ location, ...rest }: ScheduledEventPayload) => ({
  ...rest,
  privacy_level: 2, // GUILD_ONLY
  entity_type: 3, // EXTERNAL : lieu libre, sans salon vocal
  entity_metadata: { location },
});

export async function createScheduledEvent(payload: ScheduledEventPayload): Promise<string> {
  const created = await request<{ id: string }>(
    "POST",
    `/guilds/${env.DISCORD_GUILD_ID}/scheduled-events`,
    toDiscordEvent(payload),
  );
  if (!created?.id) throw new DiscordError(502, "Réponse sans identifiant");
  return created.id;
}

export async function updateScheduledEvent(id: string, payload: Partial<ScheduledEventPayload>): Promise<void> {
  const { location, ...rest } = payload;
  await request("PATCH", `/guilds/${env.DISCORD_GUILD_ID}/scheduled-events/${id}`, {
    ...rest,
    ...(location === undefined ? {} : { entity_metadata: { location } }),
  });
}

export async function deleteScheduledEvent(id: string): Promise<void> {
  try {
    await request("DELETE", `/guilds/${env.DISCORD_GUILD_ID}/scheduled-events/${id}`);
  } catch (error) {
    // Déjà supprimé à la main sur Discord : rien à faire.
    if (!(error instanceof DiscordError && error.status === 404)) throw error;
  }
}

export async function postMessage(channelId: string, content: string, pingEveryone = false): Promise<void> {
  await request("POST", `/channels/${channelId}/messages`, {
    content,
    allowed_mentions: { parse: pingEveryone ? ["everyone"] : [] },
  });
}

/** Lien d'une séance Discord (affiche l'aperçu avec l'image, la date et le lieu). */
export function scheduledEventUrl(id: string): string {
  return `https://discord.com/events/${env.DISCORD_GUILD_ID}/${id}`;
}
