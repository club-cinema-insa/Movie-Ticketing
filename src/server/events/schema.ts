import { z } from "zod";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => value || null)
    .nullable();

/** Affiche : adresse http(s) ou fichier du site (/public). */
const imageUrl = z
  .string()
  .trim()
  .max(2048)
  .refine((value) => value === "" || /^(https?:\/\/|\/)/i.test(value), "Adresse d’image invalide.")
  .transform((value) => value || null)
  .nullable();

const maxTickets = z
  .union([z.number(), z.string().trim()])
  .nullable()
  .transform((value, ctx) => {
    if (value === null || value === "") return null;
    const parsed = typeof value === "number" ? value : Number(value);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 100_000) {
      ctx.addIssue({ code: "custom", message: "Nombre de places invalide." });
      return z.NEVER;
    }
    return parsed;
  });

const eventDate = z
  .union([z.string(), z.date()])
  .transform((value, ctx) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      ctx.addIssue({ code: "custom", message: "Date invalide." });
      return z.NEVER;
    }
    return date;
  });

const fields = {
  name: z.string().trim().min(1, "Le nom est requis.").max(200),
  date: eventDate,
  location: optionalText(200),
  description: optionalText(5000),
  announceEmojis: optionalText(40),
  image: imageUrl,
  maxTickets,
  startOffsetMinutes: z.number().int().min(0, "Le début doit être après l’ouverture des portes.").max(720).nullable(),
  show: z.boolean(),
};

/** Création : le nom et la date sont requis, le reste est facultatif. */
export const createEventSchema = z.object({
  ...fields,
  location: fields.location.optional(),
  description: fields.description.optional(),
  announceEmojis: fields.announceEmojis.optional(),
  image: fields.image.optional(),
  maxTickets: fields.maxTickets.optional(),
  startOffsetMinutes: fields.startOffsetMinutes.optional(),
  show: fields.show.optional(),
});

/** Modification partielle : seuls les champs fournis sont mis à jour. */
export const updateEventSchema = z.object(fields).partial();

/** Premier message d'erreur lisible d'une validation zod. */
export function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Données invalides.";
}
