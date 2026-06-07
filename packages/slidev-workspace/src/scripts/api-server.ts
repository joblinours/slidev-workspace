#!/usr/bin/env node
/**
 * Standalone HTTP API server for production use.
 * Nginx proxies /api/ → http://localhost:3099/ in the Docker container.
 *
 * Routes:
 *   POST /api/slides/tags   – update tags in slides.md + rebuild workspace SPA
 *   GET  /api/slides/export – on-demand Playwright PDF export
 */
import http from "http";
import net from "net";
import {
  readFileSync,
  writeFileSync,
  existsSync,
  statSync,
  mkdtempSync,
  rmSync,
  createReadStream,
} from "fs";
import { stat } from "fs/promises";
import { join, dirname } from "path";
import { tmpdir } from "os";
import { fileURLToPath } from "url";
import { execFileSync } from "child_process";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { chromium } from "playwright-chromium";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLI_PATH = join(__dirname, "cli.js");
const WORKSPACE_CWD = process.env.SLIDEV_WORKSPACE_CWD || "/workspace";

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

// ── MIME types for local static server ─────────────────────────────────────
const MIME: Record<string, string> = {
  html: "text/html; charset=utf-8",
  js: "application/javascript",
  mjs: "application/javascript",
  css: "text/css",
  json: "application/json",
  svg: "image/svg+xml",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  woff2: "font/woff2",
  woff: "font/woff",
  ttf: "font/ttf",
  ico: "image/x-icon",
};

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.listen(0, "127.0.0.1", () => {
      const port = (s.address() as net.AddressInfo).port;
      s.close((err) => (err ? reject(err) : resolve(port)));
    });
  });
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

  if (format === "pptx") {
    res.writeHead(501, { "Content-Type": "text/plain" });
    res.end(
      "Format PPTX non disponible en production — utilisez PDF à la place.",
    );
    return;
  }

  // The slide source directory (for validation only)
  const slideDir = findSlideDir(slidePath);
  if (!slideDir) {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end(`Slide not found: ${slidePath}`);
    return;
  }

  // The slide was built into /workspace/dist/{slidePath}/
  const distDir = join(WORKSPACE_CWD, "dist", slidePath);
  if (!existsSync(join(distDir, "index.html"))) {
    res.writeHead(500, { "Content-Type": "text/plain" });
    res.end(
      `Slide non compilée : dist/${slidePath}/index.html introuvable. Relancez le container.`,
    );
    return;
  }

  // Read baseUrl from workspace config to reconstruct the slide's asset prefix
  const configPath = join(WORKSPACE_CWD, "slidev-workspace.yaml");
  let baseUrl = "/";
  if (existsSync(configPath)) {
    const cfg = parseYaml(readFileSync(configPath, "utf8")) as Record<
      string,
      unknown
    >;
    if (typeof cfg.baseUrl === "string") {
      baseUrl = cfg.baseUrl.endsWith("/") ? cfg.baseUrl : cfg.baseUrl + "/";
    }
  }

  // Slide was built with --base {baseUrl}{slidePath}/ so assets are at
  // /{baseUrl}{slidePath}/assets/…  We serve a local HTTP server that maps
  // those absolute paths back to the local dist directory, so Playwright can
  // load the slide without needing the external reverse proxy.
  const slideBase = `${baseUrl}${slidePath}/`;

  const localPort = await freePort();
  const localServer = http.createServer((req2, res2) => {
    let pathname = decodeURIComponent(
      new URL(req2.url!, "http://localhost").pathname,
    );

    // Strip the slide's absolute base URL prefix → relative path in distDir
    if (pathname.startsWith(slideBase)) {
      pathname = pathname.slice(slideBase.length);
    } else if (pathname === slideBase.slice(0, -1) || pathname === "/") {
      pathname = "index.html";
    }

    pathname = pathname.replace(/^\/+/, "") || "index.html";
    const filePath = join(distDir, pathname);

    if (existsSync(filePath) && !statSync(filePath).isDirectory()) {
      const ext = (filePath.split(".").pop() ?? "").toLowerCase();
      res2.writeHead(200, {
        "Content-Type": MIME[ext] ?? "application/octet-stream",
      });
      createReadStream(filePath).pipe(res2);
    } else {
      // SPA fallback → index.html
      res2.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      createReadStream(join(distDir, "index.html")).pipe(res2);
    }
  });

  await new Promise<void>((resolve) =>
    localServer.listen(localPort, "127.0.0.1", resolve),
  );

  const tmpDir = mkdtempSync(join(tmpdir(), "slidev-export-"));
  const outputFile = join(tmpDir, "export.pdf");
  let browser: Awaited<ReturnType<typeof chromium.launch>> | null = null;

  try {
    console.log(`📤 Exporting "${slidePath}" as PDF via Playwright…`);

    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    // Viewport matches Slidev's default 16:9 slide size
    await page.setViewportSize({ width: 1280, height: 720 });

    const slideUrl = `http://127.0.0.1:${localPort}${slideBase}?print`;
    console.log(`  → ${slideUrl}`);
    await page.goto(slideUrl, { waitUntil: "networkidle", timeout: 60_000 });

    // Extra settle time for fonts / animations
    await page.waitForTimeout(2_000);

    await page.pdf({
      path: outputFile,
      printBackground: true,
      landscape: true,
      format: "A4",
    });

    if (!existsSync(outputFile)) throw new Error("Playwright produced no PDF");

    const { size } = await stat(outputFile);
    const fileName = encodeURIComponent(slidePath.split("/").pop()!);
    res.writeHead(200, {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${fileName}.pdf"`,
      "Content-Length": String(size),
      "Access-Control-Allow-Origin": "*",
    });

    await new Promise<void>((resolve, reject) => {
      const stream = createReadStream(outputFile);
      stream.pipe(res);
      stream.on("end", resolve);
      stream.on("error", reject);
    });

    console.log(`✅ PDF export done: ${slidePath}`);
  } finally {
    browser?.close().catch(() => {});
    localServer.close();
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
