import QRCode from "qrcode";

/**
 * Génère un QR code en Base64 à partir du code de ticket unique.
 */
export async function generateQRCode(ticketCode: string): Promise<string> {
  try {
    // 480 px, marge réduite : net à l'écran comme à l'impression, et facile à scanner.
    return await QRCode.toDataURL(ticketCode, { width: 480, margin: 1, errorCorrectionLevel: "M" });
  } catch (err) {
    console.error("Erreur lors de la génération du QR code :", err);
    throw new Error("Impossible de générer le QR code");
  }
}
