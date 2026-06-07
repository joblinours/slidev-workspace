import { readFileSync, writeFileSync } from "node:fs";
import { PDFDocument, rgb, degrees, StandardFonts } from "pdf-lib";

/**
 * Add a diagonal watermark text to every page of a PDF.
 * The watermark is semi-transparent, centered, and rotated 45°.
 */
export async function addWatermarkToPdf(
  inputPath: string,
  outputPath: string,
  text: string,
): Promise<void> {
  const pdfBytes = readFileSync(inputPath);
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const pages = pdfDoc.getPages();

  for (const page of pages) {
    const { width, height } = page.getSize();

    // Font size scales with page width (slides are typically 960×540 or 1280×720 pts)
    const fontSize = Math.min(width, height) * 0.12;
    const textWidth = font.widthOfTextAtSize(text, fontSize);

    page.drawText(text, {
      x: width / 2 - textWidth / 2,
      y: height / 2 - fontSize / 2,
      size: fontSize,
      font,
      color: rgb(0.5, 0.5, 0.5),
      opacity: 0.35,
      rotate: degrees(45),
    });
  }

  writeFileSync(outputPath, await pdfDoc.save());
}
