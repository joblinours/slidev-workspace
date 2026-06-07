#!/usr/bin/env node
/**
 * Standalone HTTP API server for production use.
 * Nginx proxies /api/ → http://localhost:3099/ in the Docker container.
 *
 * Routes:
 *   POST /api/slides/tags   – update tags in slides.md + rebuild workspace SPA
 */
import http from "http";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";
import { execFileSync } from "child_process";
import { dirname } from "path";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";

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
