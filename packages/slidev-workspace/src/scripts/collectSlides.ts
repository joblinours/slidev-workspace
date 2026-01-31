import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

export type CollectSlidesParams = {
  slidesDirs: string[];
  names?: string[];
  exclude?: string[];
};

type SlideEntry = {
  slidesDir: string;
  slideName: string;
  slideDir: string;
};

export function collectSlides({
  slidesDirs,
  names = [],
  exclude = [],
}: CollectSlidesParams): SlideEntry[] {
  const entries: SlideEntry[] = [];

  const isExcluded = (name: string) =>
    name
      .split(/[\\/]+/)
      .filter(Boolean)
      .some((segment) => exclude.includes(segment));

  const hasSlidesFile = (dir: string) => existsSync(join(dir, "slides.md"));

  for (const slidesDir of slidesDirs) {
    if (!existsSync(slidesDir)) {
      console.warn(`⚠️ Slides directory not found: ${slidesDir}`);
      continue;
    }

    if (names.length > 0) {
      for (const slideName of names) {
        if (isExcluded(slideName)) {
          continue;
        }
        const slideDir = join(slidesDir, slideName);
        if (!existsSync(slideDir)) {
          continue;
        }
        if (!hasSlidesFile(slideDir)) {
          continue;
        }
        entries.push({ slidesDir, slideName, slideDir });
      }
      continue;
    }

    const slideDirs = readdirSync(slidesDir, { withFileTypes: true })
      .filter((dirent) => dirent.isDirectory())
      .filter((dirent) => !exclude.includes(dirent.name))
      .map((dirent) => dirent.name);

    for (const entryName of slideDirs) {
      const slideDir = join(slidesDir, entryName);
      if (hasSlidesFile(slideDir)) {
        entries.push({ slidesDir, slideName: entryName, slideDir });
        continue;
      }

      const nestedDirs = readdirSync(slideDir, { withFileTypes: true })
        .filter((dirent) => dirent.isDirectory())
        .filter((dirent) => !exclude.includes(dirent.name))
        .map((dirent) => dirent.name);

      for (const nestedName of nestedDirs) {
        const nestedSlideDir = join(slideDir, nestedName);
        if (!hasSlidesFile(nestedSlideDir)) {
          continue;
        }
        const nestedSlideName = `${entryName}/${nestedName}`;
        entries.push({
          slidesDir,
          slideName: nestedSlideName,
          slideDir: nestedSlideDir,
        });
      }
    }
  }

  return entries;
}
