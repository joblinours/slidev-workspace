import { join } from "node:path";
import { existsSync, mkdirSync } from "node:fs";
import { execSync } from "node:child_process";

import { loadConfig, resolveSlidesDirs } from "../scripts/config";
import { collectSlides } from "../scripts/collectSlides";

/**
 * Export slides to PDF and PPTX using Slidev's built-in export command.
 * Outputs are written to each slide's dist/ directory as export.pdf / export.pptx.
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
    const packageJsonPath = join(slideDir, "package.json");

    if (!existsSync(packageJsonPath)) {
      console.warn(
        `⚠️ Skipping export for ${slideName}: no package.json found`,
      );
      continue;
    }

    const slidesFile = join(slideDir, "slides.md");
    if (!existsSync(slidesFile)) {
      console.warn(`⚠️ Skipping export for ${slideName}: slides.md not found`);
      continue;
    }

    const distDir = join(slideDir, "dist");
    if (!existsSync(distDir)) {
      // Slide hasn't been built yet — skip export silently
      console.warn(
        `⚠️ Skipping export for ${slideName}: dist/ not found (build first)`,
      );
      continue;
    }

    mkdirSync(distDir, { recursive: true });

    console.log(`📄 Exporting PDF for: ${slideName}`);
    try {
      execSync(
        `pnpm exec slidev export slides.md --output dist/export.pdf --format pdf --timeout 60000`,
        { cwd: slideDir, stdio: "inherit" },
      );
      console.log(`✅ PDF exported: ${slideName}`);
    } catch (error) {
      console.warn(
        `⚠️ PDF export failed for ${slideName}:`,
        (error as Error).message,
      );
    }

    console.log(`📊 Exporting PPTX for: ${slideName}`);
    try {
      execSync(
        `pnpm exec slidev export slides.md --output dist/export.pptx --format pptx --timeout 60000`,
        { cwd: slideDir, stdio: "inherit" },
      );
      console.log(`✅ PPTX exported: ${slideName}`);
    } catch {
      // PPTX support varies by Slidev version — not a fatal error
      console.warn(`⚠️ PPTX export not available for ${slideName} (skipping)`);
    }
  }

  console.log("✅ Export step complete.");
}
