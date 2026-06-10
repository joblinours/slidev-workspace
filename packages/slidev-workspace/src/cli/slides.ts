import { join, resolve } from "node:path";
import { existsSync, mkdirSync } from "node:fs";
import { cp, rm } from "node:fs/promises";
import { execSync } from "node:child_process";

import { loadConfig, resolveSlidesDirs } from "../scripts/config";
import { collectSlides } from "../scripts/collectSlides";

export async function buildSlides(names?: string[]) {
  const workspaceCwd = process.env.SLIDEV_WORKSPACE_CWD || process.cwd();
  const config = loadConfig(workspaceCwd);
  const slidesDirs = resolveSlidesDirs(config, workspaceCwd);

  console.log(
    names
      ? `🔨 Building slides: ${names.join(", ")}...`
      : "🔨 Building all slides...",
  );

  const slides = collectSlides({ slidesDirs, names, exclude: config.exclude });

  for (const { slideDir, slideName } of slides) {
    const packageJsonPath = join(slideDir, "package.json");

    if (!existsSync(packageJsonPath)) {
      console.warn(`⚠️ Skipping ${slideName}: no package.json found`);
      continue;
    }

    // Install dependencies for new slides added after container startup
    if (!existsSync(join(slideDir, "node_modules", ".bin", "slidev"))) {
      console.log(`📦 Installing dependencies for ${slideName}...`);
      execSync("CI=true pnpm install --no-frozen-lockfile", {
        cwd: slideDir,
        stdio: "inherit",
      });
      execSync("pnpm add @slidev/cli@latest", {
        cwd: slideDir,
        stdio: "inherit",
      });
      execSync(
        "PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 pnpm add playwright-chromium@1.50.0",
        { cwd: slideDir, stdio: "inherit" },
      );
    }

    console.log(`📦 Building slide: ${slideName}`);

    try {
      const baseUrl = config.baseUrl.endsWith("/")
        ? config.baseUrl
        : config.baseUrl + "/";
      // Run build directly in the slide directory so Vite's root is set correctly.
      // This fixes fs.allow issues with absolute-path assets (e.g. /image.svg in public/).
      const buildCmd = `pnpm run build --base ${baseUrl}${slideName}/`;
      console.log(buildCmd);
      execSync(buildCmd, {
        cwd: slideDir,
        stdio: "inherit",
      });
      console.log(`✅ Built slide: ${slideName}`);
    } catch (error) {
      console.error(
        `❌ Failed to build slide ${slideName}:`,
        (error as Error).message,
      );
      console.warn(`⚠️ Skipping ${slideName} — continuing with other slides.`);
    }
  }
}

export async function exportOgImages() {
  const workspaceCwd = process.env.SLIDEV_WORKSPACE_CWD || process.cwd();
  const config = loadConfig(workspaceCwd);
  const slidesDirs = resolveSlidesDirs(config, workspaceCwd);

  console.log("🖼️ Exporting OG images for all slides...");

  try {
    // Run export command for all slides
    execSync("pnpm -r export --format png --range 1", {
      cwd: workspaceCwd,
      stdio: "inherit",
    });

    console.log("📦 Copying exported images to og-image.png...");

    // Copy the exported files to og-image.png for each slide
    const slides = collectSlides({ slidesDirs, exclude: config.exclude });

    for (const { slideDir, slideName } of slides) {
      const packageJsonPath = join(slideDir, "package.json");

      if (!existsSync(packageJsonPath)) {
        continue;
      }

      const exportedFile = join(slideDir, "slides-export", "1.png");
      const targetFile = join(slideDir, "og-image.png");
      const exportDir = join(slideDir, "slides-export");

      if (existsSync(exportedFile)) {
        await cp(exportedFile, targetFile);
        console.log(`✅ Generated OG image for: ${slideName}`);

        // Clean up the slides-export directory
        await rm(exportDir, { recursive: true, force: true });
      } else {
        console.warn(
          `⚠️ Export file not found for ${slideName}: ${exportedFile}`,
        );
      }
    }

    console.log("✅ All OG images exported successfully!");
  } catch (error) {
    console.error("❌ Failed to export OG images:", error);
    process.exit(1);
  }
}

export async function copySlidesToOutputDir(names?: string[]) {
  const workspaceCwd = process.env.SLIDEV_WORKSPACE_CWD || process.cwd();
  const config = loadConfig(workspaceCwd);
  const slidesDirs = resolveSlidesDirs(config, workspaceCwd);
  const deployDir = resolve(workspaceCwd, config.outputDir);

  console.log(`📁 Copying slide builds into ${deployDir}...`);

  // Ensure the deployment directory exists. Vite build should create it, but guard just in case.
  if (!existsSync(deployDir)) {
    mkdirSync(deployDir, { recursive: true });
  }

  // Copy slides
  const slides = collectSlides({ slidesDirs, names, exclude: config.exclude });

  for (const { slideDir, slideName } of slides) {
    const slideDistDir = join(slideDir, "dist");
    const targetDir = join(deployDir, slideName);

    if (existsSync(slideDistDir)) {
      console.log(`📋 Copying ${slideName}...`);
      await cp(slideDistDir, targetDir, { recursive: true });
    }
  }

  console.log(`✅ All slide assets copied into ${deployDir}!`);
}
