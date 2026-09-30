import fs from "fs";
import path from "path";
import PDFDocument from "pdfkit";
import { branding } from "@/config/branding";

export type TicketPDFInput = {
  participantName: string;
  eventName: string;
  /** Ex. « samedi 15 novembre 2025 » */
  dateLabel: string;
  /** Ex. « 20:00 » */
  timeLabel: string;
  location: string;
  code: string;
  /** Data URL PNG du QR code. */
  qrCodeDataUrl: string;
  ticketNumber?: number;
  maxTickets?: number;
  /** Affiche du film (URL absolue, chemin /public ou data URL). Facultatif. */
  posterUrl?: string | null;
  /** Informations pratiques de la projection. Facultatif. */
  info?: string | null;
};

const PAGE_WIDTH = 360;
const MARGIN = 24;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const BAND_HEIGHT = 84;
const POSTER_HEIGHT = 170;
const QR_SIZE = 170;

const INK = "#0f172a";
const MUTED = "#64748b";
const LINE = "#cbd5e1";
const PAGE_BG = "#e2e8f0";

const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
const REMOTE_IMAGE_TIMEOUT_MS = 2500;

/**
 * Charge une image (PNG/JPEG) depuis une data URL, /public ou une URL http(s).
 * Retourne null en cas d'échec : l'image est décorative, le billet reste valide sans elle.
 */
async function loadImage(src: string | null | undefined): Promise<Buffer | null> {
  if (!src) return null;
  try {
    if (src.startsWith("data:")) {
      const comma = src.indexOf(",");
      return comma === -1 ? null : Buffer.from(src.slice(comma + 1), "base64");
    }

    if (src.startsWith("/")) {
      const publicDir = path.resolve(process.cwd(), "public");
      const file = path.resolve(publicDir, "." + src);
      if (!file.startsWith(publicDir + path.sep)) return null;
      return await fs.promises.readFile(file);
    }

    if (/^https?:\/\//i.test(src)) {
      const res = await fetch(src, {
        signal: AbortSignal.timeout(REMOTE_IMAGE_TIMEOUT_MS),
      });
      if (!res.ok) return null;
      const type = res.headers.get("content-type") ?? "";
      if (!/image\/(png|jpe?g)/i.test(type)) return null;
      const buf = Buffer.from(await res.arrayBuffer());
      return buf.length <= MAX_IMAGE_BYTES ? buf : null;
    }
  } catch {
    // Image indisponible : on l'ignore.
  }
  return null;
}

function drawImageSafe(
  doc: PDFKit.PDFDocument,
  image: Buffer | null,
  draw: (buf: Buffer) => void,
) {
  if (!image) return;
  try {
    draw(image);
  } catch {
    // Format non supporté par pdfkit (ex. WebP) : on ignore.
  }
}

/**
 * Génère le billet PDF en pur JS (pdfkit) : quelques dizaines de millisecondes,
 * sans navigateur headless.
 */
export async function generateTicketPDF(input: TicketPDFInput): Promise<Buffer> {
  const [clubLogo, poster] = await Promise.all([
    loadImage(branding.logoUrl),
    loadImage(input.posterUrl),
  ]);
  const qr = await loadImage(input.qrCodeDataUrl);
  if (!qr) throw new Error("QR code invalide");

  const hasPoster = poster !== null;
  const posterBlock = hasPoster ? POSTER_HEIGHT : 0;

  const doc = new PDFDocument({
    size: [PAGE_WIDTH, 600 + posterBlock],
    margin: 0,
    info: {
      Title: `Billet — ${input.eventName}`,
      Author: branding.appName,
    },
  });

  const chunks: Buffer[] = [];
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  // Fond et carte blanche (les encoches de la perforation reprennent la couleur du fond)
  doc.rect(0, 0, PAGE_WIDTH, doc.page.height).fill(PAGE_BG);
  doc.rect(0, BAND_HEIGHT, PAGE_WIDTH, doc.page.height - BAND_HEIGHT).fill("#ffffff");

  // Bandeau aux couleurs du club
  doc.rect(0, 0, PAGE_WIDTH, BAND_HEIGHT).fill(branding.primaryColor);
  doc.circle(MARGIN + 26, BAND_HEIGHT / 2, 28).fill("#ffffff");
  drawImageSafe(doc, clubLogo, (buf) =>
    doc.image(buf, MARGIN + 26 - 22, BAND_HEIGHT / 2 - 22, { fit: [44, 44], align: "center", valign: "center" }),
  );
  doc
    .fillColor("#ffffff")
    .font("Helvetica-Bold")
    .fontSize(15)
    .text(branding.appName, MARGIN + 66, BAND_HEIGHT / 2 - 9, {
      width: CONTENT_WIDTH - 66,
      height: 40,
      ellipsis: true,
    });

  // Affiche
  if (poster) {
    doc.save();
    doc.rect(0, BAND_HEIGHT, PAGE_WIDTH, POSTER_HEIGHT).clip();
    drawImageSafe(doc, poster, (buf) =>
      doc.image(buf, 0, BAND_HEIGHT, {
        cover: [PAGE_WIDTH, POSTER_HEIGHT],
        align: "center",
        valign: "center",
      }),
    );
    doc.restore();
  }

  // Titre
  let y = BAND_HEIGHT + posterBlock + 20;
  doc.fillColor(INK).font("Helvetica-Bold").fontSize(20);
  const titleHeight = Math.min(
    doc.heightOfString(input.eventName, { width: CONTENT_WIDTH }),
    52,
  );
  doc.text(input.eventName, MARGIN, y, {
    width: CONTENT_WIDTH,
    height: 52,
    ellipsis: true,
  });
  y += titleHeight + 12;

  // Date / heure / lieu
  const drawField = (label: string, value: string, x: number, width: number) => {
    doc.fillColor(MUTED).font("Helvetica-Bold").fontSize(7.5).text(label.toUpperCase(), x, y, { width, characterSpacing: 0.6 });
    doc.fillColor(INK).font("Helvetica").fontSize(12).text(value, x, y + 11, { width, height: 34, ellipsis: true });
  };
  drawField("Date", input.dateLabel, MARGIN, CONTENT_WIDTH * 0.62);
  drawField("Heure", input.timeLabel, MARGIN + CONTENT_WIDTH * 0.66, CONTENT_WIDTH * 0.34);
  y += 42;
  drawField("Lieu", input.location, MARGIN, CONTENT_WIDTH);
  y += 40;

  // Perforation
  doc.dash(4, { space: 4 }).moveTo(MARGIN + 8, y).lineTo(PAGE_WIDTH - MARGIN - 8, y).lineWidth(1).stroke(LINE).undash();
  doc.circle(0, y, 9).fill(PAGE_BG);
  doc.circle(PAGE_WIDTH, y, 9).fill(PAGE_BG);
  y += 20;

  // QR code + code
  doc.roundedRect((PAGE_WIDTH - QR_SIZE - 16) / 2, y, QR_SIZE + 16, QR_SIZE + 16, 10).lineWidth(1.5).stroke(LINE);
  doc.image(qr, (PAGE_WIDTH - QR_SIZE) / 2, y + 8, { width: QR_SIZE, height: QR_SIZE });
  y += QR_SIZE + 28;

  doc.fillColor(INK).font("Courier-Bold").fontSize(14).text(input.code, MARGIN, y, { width: CONTENT_WIDTH, align: "center" });
  y += 20;

  const numberLabel =
    input.ticketNumber !== undefined
      ? `Billet n°${input.ticketNumber}${input.maxTickets ? ` / ${input.maxTickets}` : ""}`
      : "";
  doc
    .fillColor(MUTED)
    .font("Helvetica")
    .fontSize(9.5)
    .text([input.participantName, numberLabel].filter(Boolean).join("  •  "), MARGIN, y, {
      width: CONTENT_WIDTH,
      height: 14,
      align: "center",
      ellipsis: true,
    });
  y += 24;

  // Informations pratiques
  const info = input.info?.trim();
  if (info) {
    doc.fillColor(MUTED).font("Helvetica").fontSize(8).text(info, MARGIN, y, {
      width: CONTENT_WIDTH,
      height: 34,
      align: "center",
      ellipsis: true,
    });
  }

  // Pied de billet
  doc
    .fillColor(MUTED)
    .font("Helvetica")
    .fontSize(7.5)
    .text(branding.eventTermsText, MARGIN, doc.page.height - 34, {
      width: CONTENT_WIDTH,
      height: 24,
      align: "center",
      ellipsis: true,
    });

  doc.end();
  return done;
}
