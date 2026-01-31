#!/usr/bin/env node

import { Command } from "commander";

import { exportOgImages } from "./cli/slides";
import { runViteBuild, runVitePreview } from "./cli/vite";
import { parseNames, parsePortOption, setWorkspaceCwd } from "./cli/utils";

function showHelp() {
  console.log(`
Slidev Workspace - A tool for managing multiple Slidev presentations

Usage:
  slidev-workspace <command> [options]

Commands:
  dev                  Start the development server
  build [names]        Build the preview app and selected slides (or all if omitted)
                       [names]: Optional slide folder names (comma-separated or space-separated)
  export-og            Export OG images for all slides
  help                 Show this help message
Options:
  --port, -p <number>  Set the preview server port (dev/preview only)

Examples:
  slidev-workspace dev                                    # Start development server
  slidev-workspace dev --port 3030                        # Start dev server on custom port
  slidev-workspace build                                  # Build all slides and preview app
  slidev-workspace build slide1,slide2                    # Build only specific slides by name
  slidev-workspace export-og                              # Export OG images for all slides

Configuration:
  Use slidev-workspace.yml to set baseUrl for all builds

For more information, visit: https://github.com/author/slidev-workspace
`);
}

async function main() {
  const program = new Command();

  program
    .name("slidev-workspace")
    .description(
      "A tool for managing multiple Slidev presentations with a workspace preview app",
    )
    .showHelpAfterError();

  program
    .command("dev")
    .alias("preview")
    .description("Start the development server")
    .option("-p, --port <number>", "Set the preview server port", (value) =>
      parsePortOption(value),
    )
    .action(async (options: { port?: number }) => {
      setWorkspaceCwd();
      await runVitePreview(options.port);
    });

  program
    .command("build")
    .description(
      "Build the preview app and selected slides (or all if omitted)",
    )
    .argument(
      "[names...]",
      "Optional slide folder names (comma-separated or space-separated)",
    )
    .action(async (names: string[]) => {
      setWorkspaceCwd();
      await runViteBuild(parseNames(names));
    });

  program
    .command("export-og")
    .description("Export OG images for all slides")
    .action(async () => {
      setWorkspaceCwd();
      await exportOgImages();
    });

  program
    .command("help")
    .description("Show this help message")
    .action(() => {
      showHelp();
    });

  if (process.argv.length <= 2) {
    program.outputHelp();
    return;
  }

  await program.parseAsync(process.argv);
}

main().catch((error) => {
  console.error("❌ An error occurred:", error);
  process.exit(1);
});
