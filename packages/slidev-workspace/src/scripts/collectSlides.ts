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

  for (const slidesDir of slidesDirs) {
    if (!existsSync(slidesDir)) {
      console.warn(`⚠️ Slides directory not found: ${slidesDir}`);
      continue;
    }

    if (names.length > 0) {
      for (const slideName of names) {
        if (exclude.includes(slideName)) {
          continue;
        }
        const slideDir = join(slidesDir, slideName);
        if (!existsSync(slideDir)) {
          continue;
        }
        entries.push({ slidesDir, slideName, slideDir });
      }
      continue;
    }

    const slideNames = readdirSync(slidesDir, { withFileTypes: true })
      .filter((dirent) => dirent.isDirectory())
      .filter((dirent) => !exclude.includes(dirent.name))
      .map((dirent) => dirent.name);

    for (const slideName of slideNames) {
      const slideDir = join(slidesDir, slideName);
      entries.push({ slidesDir, slideName, slideDir });
    }
  }

  return entries;
}
