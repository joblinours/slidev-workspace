#!/usr/bin/env node
/**
 * Standalone HTTP API server for production use.
 * Nginx proxies /api/ → http://localhost:3099/ in the Docker container.
 *
 * Routes:
 *   POST /api/slides/tags            – update tags in slides.md + rebuild workspace SPA
 *   GET  /api/slides/export-status   – check which export files exist for a slide
 *   POST /api/slides/export          – generate an export on-demand
 */
import http from "http";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join, resolve } from "path";
import { fileURLToPath } from "url";
import { execFileSync } from "child_process";
import { dirname } from "path";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";

import { exportSingleSlide } from "../cli/export.js";
import { loadConfig } from "./config.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLI_PATH = join(__dirname, "cli.js");
const WORKSPACE_CWD = process.env.SLIDEV_WORKSPACE_CWD || "/workspace";

const PORT = 3099;

// Simple mutex — tracks which slides are currently exporting
const exportingSlides = new Set<string>();

function collectSlidesDirs(): string[] {
  const dir = process.env.SLIDES_EFFECTIVE_DIR;
  if (!dir) {
    console.error("❌ SLIDES_EFFECTIVE_DIR is not set");
    process.exit(1);
  }
  return [dir];
}

function updateTagsInFile(fullPath: string, tags: string[]): void {
  const content = readFileSync(fullPath, "utf8");
  const match = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n/);
  if (!match) throw new Error("No frontmatter found in slides.md");

  const frontmatter = parseYaml(match[1]) as Record<string, unknown>;
  if (tags.length > 0) {
    frontmatter.tags = tags;
  } else {
    delete frontmatter.tags;
  }

  const newFm = stringifyYaml(frontmatter, { lineWidth: 0 });
  writeFileSync(
    fullPath,
    content.replace(match[0], `---\n${newFm}---\n`),
    "utf8",
  );
}

/** Resolve the dist output directory for a slide. */
function resolveOutputSlideDir(slideName: string): string {
  const config = loadConfig(WORKSPACE_CWD);
  return resolve(WORKSPACE_CWD, config.outputDir, slideName);
}

/** Find the source directory for a given slide name. */
function findSlideDir(slideName: string): string | null {
  const slidesDirs = collectSlidesDirs();
  for (const slidesDir of slidesDirs) {
    const candidate = join(slidesDir, slideName);
    if (existsSync(join(candidate, "slides.md"))) return candidate;
  }
  return null;
}

// ── HTTP server ─────────────────────────────────────────────────────────────

const server = http.createServer((req, res) => {
  const setCors = () => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  };

  if (req.method === "OPTIONS") {
    setCors();
    res.writeHead(204);
    res.end();
    return;
  }

  // ── GET /api/slides/export-status?slideName=xxx ────────────────────────
  if (
    req.method === "GET" &&
    req.url?.startsWith("/api/slides/export-status")
  ) {
    setCors();
    const url = new URL(req.url, "http://localhost");
    const slideName = url.searchParams.get("slideName");

    if (!slideName) {
      res.writeHead(400, { "Content-Type": "text/plain" });
      res.end("Missing slideName query parameter");
      return;
    }

    const outputDir = resolveOutputSlideDir(slideName);
    const status = {
      pdf: existsSync(join(outputDir, "export.pdf")),
      pdfDark: existsSync(join(outputDir, "export-dark.pdf")),
      pptx: existsSync(join(outputDir, "export.pptx")),
      pptxDark: existsSync(join(outputDir, "export-dark.pptx")),
      pdfWatermark: existsSync(join(outputDir, "export-watermark.pdf")),
      exporting: exportingSlides.has(slideName),
    };

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(status));
    return;
  }

  // ── POST /api/slides/export ────────────────────────────────────────────
  if (req.method === "POST" && req.url === "/api/slides/export") {
    setCors();
    let body = "";
    req.on("data", (chunk: Buffer) => (body += chunk.toString()));
    req.on("end", () => {
      (async () => {
        try {
          const { slideName, format, watermarkText } = JSON.parse(body) as {
            slideName: string;
            format: "pdf" | "pptx" | "pdf-dark" | "pptx-dark" | "pdf-watermark";
            watermarkText?: string;
          };

          if (!slideName || !format) {
            res.writeHead(400, { "Content-Type": "text/plain" });
            res.end("Missing slideName or format");
            return;
          }

          if (exportingSlides.has(slideName)) {
            res.writeHead(409, { "Content-Type": "application/json" });
            res.end(
              JSON.stringify({
                error: "Export already in progress for this slide",
              }),
            );
            return;
          }

          const slideDir = findSlideDir(slideName);
          if (!slideDir) {
            res.writeHead(404, { "Content-Type": "text/plain" });
            res.end(`Slide not found: ${slideName}`);
            return;
          }

          const outputSlideDir = resolveOutputSlideDir(slideName);
          exportingSlides.add(slideName);

          try {
            await exportSingleSlide(
              slideDir,
              outputSlideDir,
              slideName,
              format,
              watermarkText,
            );
          } finally {
            exportingSlides.delete(slideName);
          }

          // Build file URL relative to the workspace base URL
          const config = loadConfig(WORKSPACE_CWD);
          const baseUrl = config.baseUrl.endsWith("/")
            ? config.baseUrl
            : config.baseUrl + "/";
          const fileNames: Record<typeof format, string> = {
            pdf: "export.pdf",
            "pdf-dark": "export-dark.pdf",
            pptx: "export.pptx",
            "pptx-dark": "export-dark.pptx",
            "pdf-watermark": "export-watermark.pdf",
          };
          const fileUrl = `${baseUrl}${slideName}/${fileNames[format]}`;

          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ok: true, fileUrl }));
        } catch (err) {
          exportingSlides.delete(""); // cleanup (no-op if already deleted)
          console.error("❌ Export API error:", err);
          res.writeHead(500, { "Content-Type": "text/plain" });
          res.end(String(err));
        }
      })();
    });
    return;
  }

  // ── POST /api/slides/tags ───────────────────────────────────────────────
  if (req.method === "POST" && req.url === "/api/slides/tags") {
    setCors();
    let body = "";
    req.on("data", (chunk: Buffer) => (body += chunk.toString()));
    req.on("end", () => {
      try {
        const { path: slidePath, tags } = JSON.parse(body) as {
          path: string;
          tags: string[];
        };

        if (typeof slidePath !== "string" || !Array.isArray(tags)) {
          res.writeHead(400, { "Content-Type": "text/plain" });
          res.end("Invalid payload: path and tags required");
          return;
        }

        const slidesDirs = collectSlidesDirs();
        let found = false;

        for (const slidesDir of slidesDirs) {
          const fullPath = join(slidesDir, slidePath, "slides.md");
          if (existsSync(fullPath)) {
            updateTagsInFile(fullPath, tags);
            found = true;
            break;
          }
        }

        if (!found) {
          res.writeHead(404, { "Content-Type": "text/plain" });
          res.end(`Slide not found: ${slidePath}`);
          return;
        }

        console.log("🔄 Rebuilding workspace SPA after tag update…");
        execFileSync("node", [CLI_PATH, "build-workspace"], {
          env: { ...process.env, SLIDEV_WORKSPACE_CWD: WORKSPACE_CWD },
          stdio: "inherit",
        });
        console.log("✅ Workspace SPA rebuilt.");

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
      } catch (err) {
        console.error("❌ API error:", err);
        res.writeHead(500, { "Content-Type": "text/plain" });
        res.end(String(err));
      }
    });
    return;
  }

  res.writeHead(404);
  res.end("Not found");
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`✅ API server listening on http://127.0.0.1:${PORT}`);
});
