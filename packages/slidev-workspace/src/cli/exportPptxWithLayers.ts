import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";
import pptxgen from "pptxgenjs";

interface ParsedSlide {
  title: string;
  subtitle: string;
  bullets: string[];
  paragraphs: string[];
}

/**
 * Parse slides.md into individual slide content blocks.
 * Handles global frontmatter (first ---...--- block) and per-slide frontmatter.
 */
function parseSlidesMarkdown(content: string): ParsedSlide[] {
  const normalized = content.replace(/\r\n/g, "\n");

  // Split on slide separators --- (full line)
  const rawBlocks = normalized.split(/\n---\n|\n---$/m);

  const slides: ParsedSlide[] = [];
  let skipFirst = false;

  // If the first block is YAML frontmatter, skip it
  const firstBlock = rawBlocks[0]?.trim() ?? "";
  if (
    firstBlock &&
    !firstBlock.includes("#") &&
    /^[\w-]+:\s*\S/m.test(firstBlock)
  ) {
    skipFirst = true;
  }

  for (let i = skipFirst ? 1 : 0; i < rawBlocks.length; i++) {
    const block = rawBlocks[i]?.trim() ?? "";
    if (!block) continue;

    // Strip per-slide frontmatter lines at the top (key: value)
    let markdown = block;
    const yamlHeaderMatch = block.match(/^(?:[\w-]+:.*\n)+\n/);
    if (yamlHeaderMatch) {
      markdown = block.slice(yamlHeaderMatch[0].length).trim();
    }

    let title = "";
    let subtitle = "";
    const bullets: string[] = [];
    const paragraphs: string[] = [];
    let inCode = false;

    for (const line of markdown.split("\n")) {
      if (line.trimStart().startsWith("```")) {
        inCode = !inCode;
        continue;
      }
      if (inCode) continue;

      const trimmed = line.trim();
      if (!trimmed) continue;

      if (trimmed.startsWith("# ")) {
        title = trimmed.slice(2).trim();
      } else if (trimmed.startsWith("## ")) {
        subtitle = trimmed.slice(3).trim();
      } else if (/^[-*+]\s/.test(trimmed)) {
        bullets.push(trimmed.replace(/^[-*+]\s+/, ""));
      } else if (
        !/^#{1,6}\s/.test(trimmed) &&
        !trimmed.startsWith("<") &&
        !trimmed.startsWith("::")
      ) {
        paragraphs.push(trimmed);
      }
    }

    // Only include slides that have some content
    if (title || subtitle || bullets.length || paragraphs.length) {
      slides.push({ title, subtitle, bullets, paragraphs });
    }
  }

  return slides;
}

/**
 * Export a Slidev presentation as a PPTX with:
 * - High-res screenshot of each slide as background image
 * - Editable text boxes for title, subtitle, bullets, and paragraphs
 *
 * The text boxes are transparent (no fill) so they sit invisibly over the
 * screenshot but can be selected, edited, and repositioned in PowerPoint.
 */
export async function exportPptxWithLayers(
  slideDir: string,
  outputPath: string,
): Promise<void> {
  const slidesFile = join(slideDir, "slides.md");
  const content = readFileSync(slidesFile, "utf-8");
  const parsedSlides = parseSlidesMarkdown(content);

  // Export each slide as a PNG image using Slidev
  const pngBase = join(slideDir, "dist", "pptx-layers-bg.png");
  let pngExportOk = false;

  try {
    execSync(
      `pnpm exec slidev export slides.md --format png --output dist/pptx-layers-bg.png --timeout 90000`,
      { cwd: slideDir, stdio: "pipe" },
    );
    pngExportOk = true;
  } catch {
    console.warn(
      "⚠️  PNG export for PPTX layers failed — slides will have text boxes only (no background images)",
    );
  }

  const pptx = new pptxgen();

  // Standard 16:9 PowerPoint widescreen dimensions
  pptx.defineLayout({ name: "LAYOUT_169", width: 10, height: 5.63 });
  pptx.layout = "LAYOUT_169";

  const totalSlides = Math.max(parsedSlides.length, 1);

  for (let i = 0; i < totalSlides; i++) {
    const slideData = parsedSlides[i] ?? {
      title: "",
      subtitle: "",
      bullets: [],
      paragraphs: [],
    };
    const pptxSlide = pptx.addSlide();

    // Background: screenshot exported by Slidev (slide-{i+1}.png suffix)
    const pngPath = pngBase.replace(".png", `-${i + 1}.png`);
    if (pngExportOk && existsSync(pngPath)) {
      pptxSlide.addImage({ path: pngPath, x: 0, y: 0, w: 10, h: 5.63 });
    }

    // Title — editable text box, no visible background
    if (slideData.title) {
      pptxSlide.addText(slideData.title, {
        x: 0.4,
        y: 0.15,
        w: 9.2,
        h: 0.85,
        fontSize: 28,
        bold: true,
        color: "FFFFFF",
      });
    }

    // Subtitle
    if (slideData.subtitle) {
      pptxSlide.addText(slideData.subtitle, {
        x: 0.4,
        y: 1.05,
        w: 9.2,
        h: 0.65,
        fontSize: 20,
        italic: true,
        color: "EEEEEE",
      });
    }

    // Bullets and paragraphs grouped into one text box
    const contentStartY = slideData.title
      ? slideData.subtitle
        ? 1.8
        : 1.25
      : 0.4;

    const contentH = 5.63 - contentStartY - 0.3;

    const bulletLines = slideData.bullets.map((b) => ({
      text: b,
      options: { bullet: { type: "bullet" as const }, fontSize: 16 },
    }));

    const paraLines = slideData.paragraphs.map((p) => ({
      text: p,
      options: { fontSize: 16 },
    }));

    const allLines = [...bulletLines, ...paraLines];

    if (allLines.length > 0) {
      pptxSlide.addText(allLines, {
        x: 0.4,
        y: contentStartY,
        w: 9.2,
        h: contentH,
        color: "FFFFFF",
        valign: "top",
      });
    }
  }

  await pptx.writeFile({ fileName: outputPath });
}
