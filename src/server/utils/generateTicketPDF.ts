import fs from "fs";
import path from "path";
import PDFDocument from "pdfkit";
import { branding } from "@/config/branding";

export type TicketPDFInput = {
  participantName: string;
  eventName: string;
  /** Ex. « samedi 15 novembre 2025 » */
  dateLabel: string;
  /** Heure de début de la séance, ex. « 20h » */
  timeLabel: string;
  /** Ouverture des portes, ex. « 19h45 ». Absent : la ligne n'est pas affichée. */
  doorsLabel?: string;
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

// Géométrie (en points)
const PAGE_WIDTH = 360;
const PAD = 16; // marge autour de la carte
const CARD_WIDTH = PAGE_WIDTH - PAD * 2;
const RADIUS = 20;
const INSET = 22; // marge intérieure du contenu
const CONTENT_WIDTH = CARD_WIDTH - INSET * 2;
const HERO_MIN = 190;
const HERO_MAX = 300;
const HERO_WITHOUT_POSTER = 150;
const QR_SIZE = 168;

const INK = "#0f172a";
const MUTED = "#64748b";
const LINE = "#cbd5e1";
const PAGE_BG = "#e2e8f0";

const FONT_DIR = path.join(process.cwd(), "src", "server", "fonts");
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

let fontCache: { regular: Buffer; bold: Buffer } | null = null;

/** Police Unicode embarquée (Noto Sans, licence OFL) : accents, latin étendu, grec, cyrillique, vietnamien. */
function setupFonts(doc: PDFKit.PDFDocument) {
  fontCache ??= {
    regular: fs.readFileSync(path.join(FONT_DIR, "NotoSans-Regular.ttf")),
    bold: fs.readFileSync(path.join(FONT_DIR, "NotoSans-Bold.ttf")),
  };
  doc.registerFont("Body", fontCache.regular);
  doc.registerFont("BodyBold", fontCache.bold);
}

/**
 * Nettoie un texte avant impression : normalise, supprime les caractères de contrôle et
 * ceux que la police ne sait pas dessiner (emoji, CJK…) au lieu d'afficher des glyphes erronés.
 */
function createSanitizer(doc: PDFKit.PDFDocument) {
  doc.font("Body");
  const embedded = (doc as unknown as {
    _font: { font: { hasGlyphForCodePoint(codePoint: number): boolean } };
  })._font.font;

  return (text: string | null | undefined, fallback = ""): string => {
    const cleaned = Array.from((text ?? "").normalize("NFC"))
      .map((ch) => (/[\u0000-\u001f\u007f\u2028\u2029]/.test(ch) ? " " : ch))
      .filter((ch) => !/[\u200b-\u200f\u2060\ufeff]/.test(ch))
      .filter((ch) => embedded.hasGlyphForCodePoint(ch.codePointAt(0)!))
      .join("")
      .replace(/\s+/g, " ")
      .trim();
    return cleaned || fallback;
  };
}

/** Vérifie que pdfkit sait lire l'image et retourne ses dimensions (sinon null). */
function inspectImage(image: Buffer | null): { data: Buffer; width: number; height: number } | null {
  if (!image) return null;
  try {
    const probe = new PDFDocument({ size: [10, 10], margin: 0 });
    // openImage existe dans pdfkit mais n'est pas déclaré dans @types/pdfkit.
    const opener = probe as unknown as { openImage(data: Buffer): { width: number; height: number } };
    const { width, height } = opener.openImage(image);
    probe.end();
    return width > 0 && height > 0 ? { data: image, width, height } : null;
  } catch {
    return null;
  }
}

type Assets = {
  clubLogo: Buffer | null;
  poster: Buffer | null;
  /** Hauteur du bandeau, adaptée au format de l'affiche pour ne pas la rogner inutilement. */
  heroHeight: number;
  qr: Buffer;
};

/**
 * Dessine le billet et retourne l'ordonnée du bas du contenu.
 * Appelée une première fois pour mesurer, puis pour de bon avec la hauteur exacte.
 */
function drawTicket(
  doc: PDFKit.PDFDocument,
  input: TicketPDFInput,
  assets: Assets,
  cardHeight: number,
): number {
  const cardX = PAD;
  const cardY = PAD;
  const heroHeight = assets.heroHeight;

  // Fond de page
  doc.rect(0, 0, PAGE_WIDTH, doc.page.height).fill(PAGE_BG);

  // Carte blanche
  doc.roundedRect(cardX, cardY, CARD_WIDTH, cardHeight, RADIUS).fill("#ffffff");

  // ── Hero (affiche ou aplat de couleur), rogné aux angles de la carte ──
  doc.save();
  doc.roundedRect(cardX, cardY, CARD_WIDTH, cardHeight, RADIUS).clip();

  if (assets.poster) {
    doc.image(assets.poster, cardX, cardY, {
      cover: [CARD_WIDTH, heroHeight],
      align: "center",
      valign: "center",
    });

    // Dégradés pour la lisibilité du texte sur l'affiche
    const top = doc.linearGradient(0, cardY, 0, cardY + 90);
    top.stop(0, "#000000", 0.6).stop(1, "#000000", 0);
    doc.rect(cardX, cardY, CARD_WIDTH, 90).fill(top);

    const bottomFadeHeight = 150;
    const bottom = doc.linearGradient(0, cardY + heroHeight - bottomFadeHeight, 0, cardY + heroHeight);
    bottom.stop(0, "#000000", 0).stop(1, "#000000", 0.88);
    doc.rect(cardX, cardY + heroHeight - bottomFadeHeight, CARD_WIDTH, bottomFadeHeight).fill(bottom);
  } else {
    // Sans affiche : aplat aux couleurs du club, sans voile sombre
    doc.rect(cardX, cardY, CARD_WIDTH, heroHeight).fill(branding.primaryColor);
    doc
      .circle(cardX + CARD_WIDTH - 10, cardY + 30, 110)
      .fillOpacity(0.16)
      .fill(branding.highlightColor ?? "#ffffff");
    doc.fillOpacity(1);
  }

  // Filet d'accent (orange du logo) sous le bandeau
  doc.rect(cardX, cardY + heroHeight - 4, CARD_WIDTH, 4).fill(branding.accentColor ?? branding.primaryColor);
  doc.restore();

  // Logo du club (carré arrondi, comme dans le fichier d'origine) + nom
  const logoX = cardX + INSET;
  const logoY = cardY + 18;
  const logoSize = 42;
  if (assets.clubLogo) {
    doc.save();
    doc.roundedRect(logoX, logoY, logoSize, logoSize, 11).clip();
    doc.image(assets.clubLogo, logoX, logoY, { width: logoSize, height: logoSize });
    doc.restore();
    doc.roundedRect(logoX, logoY, logoSize, logoSize, 11).lineWidth(1.5).stroke("#ffffff");
  }
  doc
    .fillColor("#ffffff")
    .font("BodyBold")
    .fontSize(12)
    .text(branding.appName, logoX + (assets.clubLogo ? logoSize + 12 : 0), logoY + 14, {
      width: CONTENT_WIDTH - (assets.clubLogo ? logoSize + 12 : 0),
      height: 16,
      ellipsis: true,
    });

  // Titre en bas du hero : la police diminue si le titre est long (jusqu'à 4 lignes)
  const TITLE_STEPS: { size: number; maxLines: number }[] = [
    { size: 23, maxLines: 2 },
    { size: 20, maxLines: 2 },
    { size: 17, maxLines: 3 },
    { size: 15, maxLines: 4 },
  ];
  let title = TITLE_STEPS[TITLE_STEPS.length - 1]!;
  for (const step of TITLE_STEPS) {
    doc.font("BodyBold").fontSize(step.size);
    const lines = doc.heightOfString(input.eventName, { width: CONTENT_WIDTH }) / doc.currentLineHeight();
    if (lines <= step.maxLines + 0.01) {
      title = step;
      break;
    }
  }
  doc.font("BodyBold").fontSize(title.size);
  const titleMax = Math.ceil(doc.currentLineHeight() * title.maxLines) + 2;
  const titleHeight = Math.min(doc.heightOfString(input.eventName, { width: CONTENT_WIDTH }), titleMax);
  doc
    .fillColor("#ffffff")
    .text(input.eventName, cardX + INSET, cardY + heroHeight - titleHeight - 18, {
      width: CONTENT_WIDTH,
      height: titleMax,
      ellipsis: true,
    });

  // ── Date / heure / lieu ──
  let y = cardY + heroHeight + 22;
  const field = (label: string, value: string, x: number, width: number, maxHeight: number) => {
    doc
      .fillColor(MUTED)
      .font("BodyBold")
      .fontSize(7.5)
      .text(label.toUpperCase(), x, y, { width, characterSpacing: 0.8 });
    doc.fillColor(INK).font("BodyBold").fontSize(12.5);
    const h = Math.min(doc.heightOfString(value, { width }), maxHeight);
    doc.text(value, x, y + 12, { width, height: maxHeight, ellipsis: true });
    return 12 + h;
  };

  const left = cardX + INSET;
  if (input.doorsLabel) {
    // Date, puis portes / début côte à côte, puis lieu
    y += field("Date", input.dateLabel, left, CONTENT_WIDTH, 34) + 16;
    const half = CONTENT_WIDTH / 2 - 6;
    const startLabel = branding.startLabel ?? "Début";
    const hDoors = field("Ouverture des portes", input.doorsLabel, left, half, 34);
    const hStart = field(startLabel, input.timeLabel, left + half + 12, half, 34);
    y += Math.max(hDoors, hStart) + 16;
  } else {
    const dateWidth = CONTENT_WIDTH * 0.64;
    const timeX = left + CONTENT_WIDTH * 0.68;
    const h1 = field("Date", input.dateLabel, left, dateWidth, 34);
    const h2 = field("Heure", input.timeLabel, timeX, CONTENT_WIDTH * 0.32, 34);
    y += Math.max(h1, h2) + 16;
  }
  const h3 = field("Lieu", input.location, left, CONTENT_WIDTH, 34);
  y += h3 + 22;

  // ── Perforation avec encoches ──
  doc
    .dash(4, { space: 4 })
    .moveTo(cardX + 18, y)
    .lineTo(cardX + CARD_WIDTH - 18, y)
    .lineWidth(1)
    .stroke(LINE)
    .undash();
  doc.circle(cardX, y, 11).fill(PAGE_BG);
  doc.circle(cardX + CARD_WIDTH, y, 11).fill(PAGE_BG);
  y += 24;

  // ── QR code ──
  const qrBoxSize = QR_SIZE + 20;
  const qrBoxX = cardX + (CARD_WIDTH - qrBoxSize) / 2;
  doc.roundedRect(qrBoxX, y, qrBoxSize, qrBoxSize, 12).lineWidth(1.5).stroke(LINE);
  doc.image(assets.qr, qrBoxX + 10, y + 10, { width: QR_SIZE, height: QR_SIZE });
  y += qrBoxSize + 16;

  doc
    .fillColor(INK)
    .font("Courier-Bold")
    .fontSize(14)
    .text(input.code, cardX + INSET, y, { width: CONTENT_WIDTH, align: "center", characterSpacing: 1 });
  y += 22;

  const numberLabel =
    input.ticketNumber !== undefined
      ? `Billet n°${input.ticketNumber}${input.maxTickets ? ` / ${input.maxTickets}` : ""}`
      : "";
  doc
    .fillColor(MUTED)
    .font("Body")
    .fontSize(10)
    .text([input.participantName, numberLabel].filter(Boolean).join("   •   "), cardX + INSET, y, {
      width: CONTENT_WIDTH,
      height: 14,
      align: "center",
      ellipsis: true,
    });
  let contentEnd = y + 14;
  y += 26;

  // ── Informations pratiques (facultatif) ──
  const info = input.info?.trim();
  if (info) {
    doc.font("Body").fontSize(8.5);
    const infoHeight = Math.min(doc.heightOfString(info, { width: CONTENT_WIDTH - 24 }), 46);
    doc.roundedRect(cardX + INSET, y, CONTENT_WIDTH, infoHeight + 18, 10).fill("#f1f5f9");
    doc.fillColor("#475569").text(info, cardX + INSET + 12, y + 9, {
      width: CONTENT_WIDTH - 24,
      height: 46,
      align: "center",
      ellipsis: true,
    });
    contentEnd = y + infoHeight + 18;
  }

  return contentEnd;
}

/**
 * Génère le billet PDF en pur JS (pdfkit) : quelques dizaines de millisecondes,
 * sans navigateur headless. La hauteur de la page s'ajuste au contenu.
 */
export async function generateTicketPDF(input: TicketPDFInput): Promise<Buffer> {
  const [logoBuf, posterBuf, qr] = await Promise.all([
    loadImage(branding.logoUrl),
    loadImage(input.posterUrl),
    loadImage(input.qrCodeDataUrl),
  ]);
  if (!qr) throw new Error("QR code invalide");

  const logo = inspectImage(logoBuf);
  const poster = inspectImage(posterBuf);
  const heroHeight = poster
    ? Math.round(Math.min(HERO_MAX, Math.max(HERO_MIN, (CARD_WIDTH * poster.height) / poster.width)))
    : HERO_WITHOUT_POSTER;
  const assets: Assets = {
    clubLogo: logo?.data ?? null,
    poster: poster?.data ?? null,
    heroHeight,
    qr,
  };

  // Passe 1 : mesure de la hauteur du contenu sur une page provisoire très haute.
  const probe = new PDFDocument({ size: [PAGE_WIDTH, 2400], margin: 0 });
  probe.on("data", () => undefined);
  setupFonts(probe);

  const sanitize = createSanitizer(probe);
  const clean: TicketPDFInput = {
    ...input,
    eventName: sanitize(input.eventName, "Projection"),
    participantName: sanitize(input.participantName, "Participant"),
    location: sanitize(input.location, "Lieu à venir"),
    dateLabel: sanitize(input.dateLabel),
    timeLabel: sanitize(input.timeLabel),
    doorsLabel: sanitize(input.doorsLabel) || undefined,
    info: sanitize(input.info),
  };

  const contentBottom = drawTicket(probe, clean, assets, 2300);
  probe.end();

  const cardHeight = Math.ceil(contentBottom - PAD + 26);
  const pageHeight = cardHeight + PAD * 2;

  // Passe 2 : dessin définitif.
  const doc = new PDFDocument({
    size: [PAGE_WIDTH, pageHeight],
    margin: 0,
    info: { Title: `Billet — ${clean.eventName}`, Author: branding.appName },
  });
  setupFonts(doc);

  const chunks: Buffer[] = [];
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  drawTicket(doc, clean, assets, cardHeight);
  doc.end();
  return done;
}
