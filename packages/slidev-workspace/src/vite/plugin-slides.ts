import type { Plugin } from "vite";
import {
  watch,
  readdirSync,
  cpSync,
  existsSync,
  readFileSync,
  writeFileSync,
} from "fs";
import { join } from "path";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { getAllSlidesFrontmatter } from "../scripts/getSlideFrontmatter";
import { loadConfig, resolveSlidesDirs } from "../scripts/config";
import {
  startAllSlidesDevServer,
  stopAllDevServers,
  type DevServerInfo,
} from "../scripts/devServer";
import { collectSlides } from "../scripts/collectSlides";
import { transformIndexHtml } from "./transformIndexHtml";

interface SlidesPluginOptions {
  devServerBasePort?: number;
}

export function slidesPlugin(options: SlidesPluginOptions = {}): Plugin {
  let devServers: DevServerInfo[] = [];
  const devServerBasePort = options.devServerBasePort ?? 3001;

  return {
    name: "vite-plugin-slides",
    async transformIndexHtml(html) {
      return await transformIndexHtml(html);
    },

    async closeBundle() {
      // Post-build: Copy og-image-[hash].png to og-image.png in each slide's dist directory
      try {
        const config = loadConfig();
        const slidesDirs = resolveSlidesDirs(config);
        const slides = collectSlides({ slidesDirs, exclude: config.exclude });

        for (const { slideDir } of slides) {
          // Each slide has its own dist directory: slides/[slideDir]/dist
          const slideDistPath = join(slideDir, "dist");
          const assetsPath = join(slideDistPath, "assets");

          if (!existsSync(assetsPath)) {
            continue;
          }

          // Look for og-image-[hash].png files in assets
          const assetFiles = readdirSync(assetsPath);
          const ogImageFile = assetFiles.find((file) =>
            /^og-image-[a-zA-Z0-9]+\.png$/.test(file),
          );

          if (ogImageFile) {
            const sourceFile = join(assetsPath, ogImageFile);
            const destFile = join(slideDistPath, "og-image.png");

            try {
              cpSync(sourceFile, destFile, { force: true });
            } catch (error) {
              console.warn(
                `⚠ Failed to copy og-image for ${slideDir}:`,
                error,
              );
            }
          }
        }
      } catch (error) {
        console.warn("⚠ og-image post-build error:", error);
      }
    },

    async configureServer(server) {
      const watchers: ReturnType<typeof watch>[] = [];

      // Resolve slides directories at runtime, not build time
      const config = loadConfig();
      const slidesDirs = resolveSlidesDirs(config);

      try {
        devServers = await startAllSlidesDevServer({
          basePort: devServerBasePort,
        });
      } catch (error) {
        console.error("❌ Failed to start slides dev servers:", error);
      }

      // API middleware: POST /api/slides/tags — update tags in slides.md frontmatter
      server.middlewares.use((req, res, next) => {
        if (req.method !== "POST" || req.url !== "/api/slides/tags") {
          return next();
        }

        let body = "";
        req.on("data", (chunk: Buffer) => (body += chunk.toString()));
        req.on("end", () => {
          try {
            const { path: slidePath, tags } = JSON.parse(body) as {
              path: string;
              tags: string[];
            };

            if (typeof slidePath !== "string" || !Array.isArray(tags)) {
              res.statusCode = 400;
              res.end("Invalid payload: path and tags required");
              return;
            }

            const slides = collectSlides({
              slidesDirs,
              exclude: config.exclude,
            });
            const entry = slides.find((s) => s.slideName === slidePath);

            if (!entry) {
              res.statusCode = 404;
              res.end(`Slide not found: ${slidePath}`);
              return;
            }

            const fullPath = join(entry.slideDir, "slides.md");
            const content = readFileSync(fullPath, "utf8");

            const frontmatterMatch = content.match(
              /^---\s*\n([\s\S]*?)\n---\s*\n/,
            );
            if (!frontmatterMatch) {
              res.statusCode = 422;
              res.end("No frontmatter found in slides.md");
              return;
            }

            const frontmatter = parseYaml(frontmatterMatch[1]) as Record<
              string,
              unknown
            >;
            if (tags.length > 0) {
              frontmatter.tags = tags;
            } else {
              delete frontmatter.tags;
            }

            const newFrontmatter = stringifyYaml(frontmatter, { lineWidth: 0 });
            const updated = content.replace(
              frontmatterMatch[0],
              `---\n${newFrontmatter}---\n`,
            );

            writeFileSync(fullPath, updated, "utf8");

            res.statusCode = 200;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ ok: true }));
          } catch (err) {
            console.error("❌ /api/slides/tags error:", err);
            res.statusCode = 500;
            res.end(String(err));
          }
        });
      });

      // Watch for changes in all slides directories
      slidesDirs.forEach((slidesDir) => {
        const watcher = watch(
          slidesDir,
          { recursive: true },
          (eventType, filename) => {
            if (filename && filename.endsWith("slides.md")) {
              // Reload frontmatter
              try {
                const slides = getAllSlidesFrontmatter();

                // Trigger HMR update
                server.ws.send({
                  type: "custom",
                  event: "slides-updated",
                  data: slides,
                });
              } catch (error) {
                console.error("❌ Error reading slides frontmatter:", error);
              }
            }
          },
        );

        watchers.push(watcher);
      });

      // Clean up watchers and dev servers when the server is closed
      server.httpServer?.once("close", () => {
        watchers.forEach((watcher) => watcher.close());
        if (devServers.length > 0) {
          stopAllDevServers(devServers);
        }
      });
    },

    // Provide virtual modules to get slides data and config
    resolveId(id) {
      if (id === "slidev:content" || id === "slidev:config") {
        return id;
      }
    },

    load(id) {
      if (id === "slidev:content") {
        try {
          const slides = getAllSlidesFrontmatter();
          return `export const slidesData = ${JSON.stringify(slides, null, 2)};
export default slidesData;`;
        } catch (error) {
          console.error("Error loading slides data:", error);
          return `export const slidesData = [];
export default slidesData;`;
        }
      }

      if (id === "slidev:config") {
        try {
          const config = loadConfig();
          const configData = {
            hero: config.hero,
            sidebar: config.sidebar,
          };
          return `export const configData = ${JSON.stringify(configData, null, 2)};
export default configData;`;
        } catch (error) {
          console.error("Error loading config:", error);
          return `export const configData = { hero: {} };
export default configData;`;
        }
      }
    },
  };
}
