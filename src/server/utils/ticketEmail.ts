import type { Event, Participant, Ticket } from "@prisma/client";
import { branding } from "@/config/branding";
import { formatDate, formatTime, startAfterDoors } from "@/server/utils/ticketDocument";
import { runtimeInfo } from "@/lib/format";
import { siteUrl } from "@/server/utils/siteUrl";
import { manageTicketPath } from "@/server/tickets/cancel";

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

type Row = { label: string; value: string };

function scheduleRows(event: Event): Row[] {
  const start = startAfterDoors(event);
  const rows: Row[] = [{ label: "Date", value: formatDate(event.date) }];

  if (start) {
    rows.push({ label: "Ouverture des portes", value: formatTime(event.date) });
    rows.push({ label: branding.startLabel ?? "Début", value: formatTime(start) });
  } else {
    rows.push({ label: "Heure", value: formatTime(event.date) });
  }

  const runtime = runtimeInfo(event.date, event.startOffsetMinutes, event.runtimeMinutes);
  if (runtime) rows.push({ label: "Durée", value: `${runtime.duration}, fin prévue vers ${runtime.end}` });

  rows.push({ label: "Lieu", value: event.location ?? "À préciser" });
  return rows;
}

/** E-mail de billet : version HTML (aux couleurs du club) et version texte, sans emoji. */
export function buildTicketEmail(params: {
  event: Event;
  participant: Participant;
  ticket: Ticket;
  reused: boolean;
}): { subject: string; html: string; text: string } {
  const { event, participant, ticket, reused } = params;

  const ink = branding.inkColor ?? "#0f172a";
  const canvas = branding.canvasColor ?? "#f8fafc";
  const brand = branding.primaryColor;
  const dark = branding.secondaryColor;
  const accent = branding.accentColor ?? brand;
  const muted = "#50696a";

  const base = siteUrl();
  const pdfLink = base ? `${base}/api/tickets/${ticket.code}/pdf` : null;
  const manageLink = base ? `${base}${manageTicketPath(ticket.code)}` : null;
  const logo = base ? `${base}${branding.logoUrl}` : null;
  const rows = scheduleRows(event);

  const title = reused ? "Voici à nouveau votre billet" : "Votre billet est prêt";
  const intro = reused
    ? "Vous aviez déjà réservé votre place pour cette séance. Votre billet est de nouveau joint à ce message."
    : "Votre place est réservée. Votre billet est joint à ce message, au format PDF.";
  const advice = "Présentez le QR code à l’entrée.";
  const cancelAdvice = "Un empêchement ? Libérez votre place pour un autre étudiant en annulant votre réservation (possible jusqu’à l’ouverture des portes).";

  const rowsHtml = rows
    .map(
      ({ label, value }) => `
        <tr>
          <td style="padding:6px 16px 6px 0;font-size:13px;color:${muted};white-space:nowrap;vertical-align:top;">${escapeHtml(label)}</td>
          <td style="padding:6px 0;font-size:15px;font-weight:600;color:${ink};">${escapeHtml(value)}</td>
        </tr>`,
    )
    .join("");

  const html = `<!doctype html>
<html lang="fr">
  <body style="margin:0;padding:0;background:${canvas};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${ink};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${canvas};padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e6e1cf;">
            <tr>
              <td style="background:${dark};padding:20px 24px;">
                <table role="presentation" cellpadding="0" cellspacing="0"><tr>
                  ${logo ? `<td style="padding-right:12px;"><img src="${escapeHtml(logo)}" width="40" height="40" alt="" style="display:block;border-radius:10px;"></td>` : ""}
                  <td style="font-size:18px;font-weight:700;color:#ffffff;">${escapeHtml(branding.appName)}</td>
                </tr></table>
              </td>
            </tr>
            <tr>
              <td style="padding:28px 24px 8px 24px;">
                <h1 style="margin:0 0 12px 0;font-size:24px;line-height:1.2;color:${ink};">${escapeHtml(title)}</h1>
                <p style="margin:0 0 6px 0;font-size:15px;line-height:1.5;">Bonjour ${escapeHtml(participant.name)},</p>
                <p style="margin:0;font-size:15px;line-height:1.5;">${escapeHtml(intro)}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 24px 8px 24px;">
                <div style="border:1px solid #e6e1cf;border-radius:12px;padding:14px 16px;background:${canvas};">
                  <p style="margin:0 0 ${event.director ? 2 : 6}px 0;font-size:17px;font-weight:700;color:${ink};">${escapeHtml(event.name)}</p>
                  ${event.director ? `<p style="margin:0 0 6px 0;font-size:13px;color:${muted};">Réalisé par ${escapeHtml(event.director)}</p>` : ""}
                  <table role="presentation" cellpadding="0" cellspacing="0">${rowsHtml}</table>
                </div>
              </td>
            </tr>
            ${
              pdfLink
                ? `<tr>
              <td style="padding:16px 24px 0 24px;">
                <a href="${escapeHtml(pdfLink)}" style="display:inline-block;background:${accent};color:${ink};font-weight:700;font-size:15px;text-decoration:none;padding:13px 22px;border-radius:12px;">Télécharger mon billet</a>
              </td>
            </tr>`
                : ""
            }
            <tr>
              <td style="padding:16px 24px 8px 24px;">
                <p style="margin:0;font-size:14px;line-height:1.5;color:${muted};">${escapeHtml(advice)}</p>
              </td>
            </tr>
            ${
              manageLink
                ? `<tr>
              <td style="padding:8px 24px 8px 24px;">
                <p style="margin:0;font-size:14px;line-height:1.5;color:${muted};">${escapeHtml(cancelAdvice)} <a href="${escapeHtml(manageLink)}" style="color:${brand};font-weight:600;">Annuler ma réservation</a></p>
              </td>
            </tr>`
                : ""
            }
            <tr>
              <td style="padding:16px 24px 28px 24px;">
                <p style="margin:0;font-size:14px;color:${ink};">${escapeHtml(branding.emailSignature)}</p>
              </td>
            </tr>
          </table>
          <p style="margin:16px 0 0 0;font-size:12px;color:${muted};">${escapeHtml(branding.eventTermsText)}</p>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const text = [
    title,
    "",
    `Bonjour ${participant.name},`,
    intro,
    "",
    event.name,
    ...(event.director ? [`Réalisé par ${event.director}`] : []),
    ...rows.map(({ label, value }) => `${label} : ${value}`),
    "",
    ...(pdfLink ? [`Télécharger mon billet : ${pdfLink}`, ""] : []),
    advice,
    ...(manageLink ? ["", cancelAdvice, `Annuler ma réservation : ${manageLink}`] : []),
    "",
    branding.emailSignature,
  ].join("\n");

  return { subject: `Votre billet : ${event.name}`, html, text };
}
