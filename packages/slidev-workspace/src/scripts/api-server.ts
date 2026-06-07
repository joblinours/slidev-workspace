#!/usr/bin/env node
/**
 * Standalone HTTP API server for production use.
 * Nginx proxies /api/ → http://localhost:3099/ in the Docker container.
 *
 * Routes:
 *   POST /api/slides/tags   – update tags in slides.md + rebuild workspace SPA
 *   GET  /api/slides/export – on-demand Playwright PDF/PPTX export
 */
import http from "http";
import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdtempSync,
  rmSync,
  createReadStream,
} from "fs";
import { stat } from "fs/promises";
import { join, dirname } from "path";
import { tmpdir } from "os";
import { fileURLToPath } from "url";
import { execFile, execFileSync } from "child_process";
import { promisify } from "util";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLI_PATH = join(__dirname, "cli.js");
const WORKSPACE_CWD = process.env.SLIDEV_WORKSPACE_CWD || "/workspace";
const execFileAsync = promisify(execFile);

const PORT = 3099;

function collectSlidesDirs(): string[] {
  const dir = process.env.SLIDES_EFFECTIVE_DIR;
  if (!dir) {
    console.error("❌ SLIDES_EFFECTIVE_DIR is not set");
    process.exit(1);
  }
  return [dir];
}

function findSlideDir(slidePath: string): string | null {
  for (const dir of collectSlidesDirs()) {
    const candidate = join(dir, slidePath);
    if (existsSync(join(candidate, "slides.md"))) return candidate;
  }
  return null;
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

// ── Export endpoint (async) ─────────────────────────────────────────────────

async function handleExport(
  req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<void> {
  const urlObj = new URL(req.url!, `http://localhost`);
  const slidePath = urlObj.searchParams.get("path");
  const format = urlObj.searchParams.get("format") ?? "pdf";

  if (!slidePath || !["pdf", "pptx"].includes(format)) {
    res.writeHead(400, { "Content-Type": "text/plain" });
    res.end("Invalid params: path and format (pdf|pptx) required");
    return;
  }

  const slideDir = findSlideDir(slidePath);
  if (!slideDir) {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end(`Slide not found: ${slidePath}`);
    return;
  }

  const tmpDir = mkdtempSync(join(tmpdir(), "slidev-export-"));
  const outputFile = join(tmpDir, `export.${format}`);

  try {
    console.log(`📤 Exporting "${slidePath}" as ${format.toUpperCase()}…`);

    await execFileAsync(
      "pnpm",
      [
        "exec",
        "slidev",
        "export",
        "slides.md",
        "--output",
        outputFile,
        "--format",
        format,
        "--timeout",
        "120000",
      ],
      { cwd: slideDir, timeout: 180_000 },
    );

    if (!existsSync(outputFile))
      throw new Error("Slidev produced no output file");

    const { size } = await stat(outputFile);

    const mimeTypes: Record<string, string> = {
      pdf: "application/pdf",
      pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    };

    res.writeHead(200, {
      "Content-Type": mimeTypes[format],
      "Content-Disposition": `attachment; filename="${encodeURIComponent(slidePath)}.${format}"`,
      "Content-Length": String(size),
      "Access-Control-Allow-Origin": "*",
    });

    await new Promise<void>((resolve, reject) => {
      const stream = createReadStream(outputFile);
      stream.pipe(res);
      stream.on("end", resolve);
      stream.on("error", reject);
    });

    console.log(`✅ Export done: ${slidePath}.${format}`);
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
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

  // ── GET /api/slides/export ──────────────────────────────────────────────
  if (req.method === "GET" && req.url?.startsWith("/api/slides/export")) {
    setCors();
    handleExport(req, res).catch((err) => {
      console.error("❌ Export error:", err);
      if (!res.headersSent) {
        res.writeHead(500, { "Content-Type": "text/plain" });
        res.end(String(err));
      }
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
