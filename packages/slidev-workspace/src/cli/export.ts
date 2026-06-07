import { join, resolve } from "node:path";
import { existsSync, mkdirSync, copyFileSync } from "node:fs";
import { execSync } from "node:child_process";

import { loadConfig, resolveSlidesDirs } from "../scripts/config";
import { collectSlides } from "../scripts/collectSlides";
import { exportPptxWithLayers } from "./exportPptxWithLayers";
import { addWatermarkToPdf } from "./exportWatermark";

type ExportFormat = "pdf" | "pptx" | "pdf-dark" | "pptx-dark" | "pdf-watermark";

/** Run `slidev export` for a given format and copy the output to the workspace dist. */
function runSlidevExport(
  slideDir: string,
  outputSlideDir: string,
  outputFile: string,
  args: string,
): void {
  execSync(`pnpm exec slidev export slides.md ${args} --timeout 60000`, {
    cwd: slideDir,
    stdio: "inherit",
  });
  const src = join(slideDir, "dist", outputFile);
  if (existsSync(src)) {
    copyFileSync(src, join(outputSlideDir, outputFile));
  }
}

/**
 * Export a single slide in the requested format.
 * Called both from `exportSlides()` (batch) and from the on-demand API endpoint.
 */
export async function exportSingleSlide(
  slideDir: string,
  outputSlideDir: string,
  slideName: string,
  format: ExportFormat,
  watermarkText = "CONFIDENTIEL",
): Promise<void> {
  mkdirSync(join(slideDir, "dist"), { recursive: true });
  mkdirSync(outputSlideDir, { recursive: true });

  switch (format) {
    case "pdf":
      console.log(`📄 Exporting PDF (light): ${slideName}`);
      runSlidevExport(
        slideDir,
        outputSlideDir,
        "export.pdf",
        `--output dist/export.pdf --format pdf`,
      );
      console.log(`✅ PDF (light) exported: ${slideName}`);
      break;

    case "pdf-dark":
      console.log(`🌙 Exporting PDF (dark): ${slideName}`);
      runSlidevExport(
        slideDir,
        outputSlideDir,
        "export-dark.pdf",
        `--output dist/export-dark.pdf --format pdf --dark`,
      );
      console.log(`✅ PDF (dark) exported: ${slideName}`);
      break;

    case "pptx":
      console.log(`📊 Exporting PPTX (layered): ${slideName}`);
      await exportPptxWithLayers(
        slideDir,
        join(slideDir, "dist", "export.pptx"),
      );
      const pptxSrc = join(slideDir, "dist", "export.pptx");
      if (existsSync(pptxSrc)) {
        copyFileSync(pptxSrc, join(outputSlideDir, "export.pptx"));
      }
      console.log(`✅ PPTX (layered) exported: ${slideName}`);
      break;

    case "pptx-dark":
      console.log(`🌙 Exporting PPTX (dark): ${slideName}`);
      runSlidevExport(
        slideDir,
        outputSlideDir,
        "export-dark.pptx",
        `--output dist/export-dark.pptx --format pptx --dark`,
      );
      console.log(`✅ PPTX (dark) exported: ${slideName}`);
      break;

    case "pdf-watermark": {
      console.log(`🔒 Exporting PDF with watermark: ${slideName}`);
      const lightPdf = join(outputSlideDir, "export.pdf");
      if (!existsSync(lightPdf)) {
        // Generate light PDF first if missing
        await exportSingleSlide(slideDir, outputSlideDir, slideName, "pdf");
      }
      const watermarkDest = join(outputSlideDir, "export-watermark.pdf");
      await addWatermarkToPdf(lightPdf, watermarkDest, watermarkText);
      console.log(`✅ PDF with watermark exported: ${slideName}`);
      break;
    }
  }
}

/**
 * Export all slides (or the named subset) to PDF/PPTX in light and dark modes.
 * Outputs are written to each slide's dist/ directory and copied to the workspace dist.
 * Requires Playwright + Chromium (available in the Docker image).
 */
export async function exportSlides(names?: string[]) {
  const workspaceCwd = process.env.SLIDEV_WORKSPACE_CWD || process.cwd();
  const config = loadConfig(workspaceCwd);
  const slidesDirs = resolveSlidesDirs(config, workspaceCwd);

  console.log(
    names?.length
      ? `📤 Exporting slides: ${names.join(", ")}...`
      : "📤 Exporting all slides...",
  );

  const slides = collectSlides({ slidesDirs, names, exclude: config.exclude });

  for (const { slideDir, slideName } of slides) {
    if (!existsSync(join(slideDir, "package.json"))) {
      console.warn(
        `⚠️ Skipping export for ${slideName}: no package.json found`,
      );
      continue;
    }
    if (!existsSync(join(slideDir, "slides.md"))) {
      console.warn(`⚠️ Skipping export for ${slideName}: slides.md not found`);
      continue;
    }

    const outputSlideDir = resolve(workspaceCwd, config.outputDir, slideName);

    for (const format of [
      "pdf",
      "pdf-dark",
      "pptx",
      "pptx-dark",
    ] as ExportFormat[]) {
      try {
        await exportSingleSlide(slideDir, outputSlideDir, slideName, format);
      } catch (err) {
        console.warn(
          `⚠️ ${format} export failed for ${slideName}:`,
          (err as Error).message,
        );
      }
    }
  }

  console.log("✅ Export step complete.");
}
