import { computed, ref } from "vue";
import MiniSearch from "minisearch";
import type { SlideData, SlideInfo } from "../../types/slide";
import { IS_DEVELOPMENT } from "../constants/env";
import { pathJoin } from "../lib/pathJoin";

function isUrl(str: string | undefined): boolean {
  if (!str) return false;
  try {
    new URL(str);
    return true;
  } catch {
    return false;
  }
}

/**
 * Resolve image URL with fallback priority:
 * 1. og-image.png (if it exists in the slides root directory)
 * 2. seoMeta.ogImage (explicit og-image config)
 * 3. background (background image)
 * 4. default cover image (https://cover.sli.dev)
 */
export function resolveImageUrl(slide: SlideInfo, domain: string): string {
  const { hasOgImage, path: slidePath, baseUrl, frontmatter } = slide;
  const seoOgImage = frontmatter.seoMeta?.ogImage;
  const background = frontmatter.background;

  if (hasOgImage) {
    const imagePath = `og-image.png?v=${Date.now()}`;
    try {
      const path = IS_DEVELOPMENT
        ? imagePath
        : pathJoin(baseUrl, slidePath, imagePath);
      return new URL(path, domain).href;
    } catch (error) {
      console.error("Failed to resolve og-image.png path:", error);
      return "https://cover.sli.dev";
    }
  }

  if (seoOgImage) {
    if (isUrl(seoOgImage)) return seoOgImage;
    try {
      return IS_DEVELOPMENT
        ? new URL(seoOgImage, domain).href
        : new URL(pathJoin(baseUrl, slidePath, seoOgImage), domain).href;
    } catch (error) {
      console.error("Failed to resolve seoMeta.ogImage path:", error);
      return "https://cover.sli.dev";
    }
  }

  if (background) {
    if (isUrl(background)) return background;
    try {
      return IS_DEVELOPMENT
        ? new URL(background, domain).href
        : new URL(pathJoin(baseUrl, slidePath, background), domain).href;
    } catch (error) {
      console.error("Failed to resolve background path:", error);
      return "https://cover.sli.dev";
    }
  }

  return "https://cover.sli.dev";
}

let miniSearch: MiniSearch | null = null;

export function useSlides() {
  const slidesData = ref<SlideInfo[]>([]);
  const isLoading = ref(true);
  const devServerBasePort =
    typeof __SLIDEV_WORKSPACE_DEV_PORT_BASE__ === "number"
      ? __SLIDEV_WORKSPACE_DEV_PORT_BASE__
      : 3001;

  const loadSlidesData = async () => {
    try {
      const module = await import("slidev:content");
      slidesData.value = module.default || [];

      // Build full-text search index
      miniSearch = new MiniSearch<{ id: string }>({
        fields: ["title", "description", "author", "content", "tags"],
        storeFields: ["id"],
        searchOptions: {
          boost: { title: 2, tags: 1.5 },
          fuzzy: 0.2,
          prefix: true,
        },
      });
      miniSearch.addAll(
        slidesData.value.map((s) => ({
          id: s.id,
          title: s.frontmatter.title || s.path,
          description:
            s.frontmatter.info || s.frontmatter.seoMeta?.ogDescription || "",
          author: s.frontmatter.author || "",
          content: s.content,
          tags: (s.frontmatter.tags || []).join(" "),
        })),
      );
    } catch {
      slidesData.value = [];
    } finally {
      isLoading.value = false;
    }
  };

  loadSlidesData();

  const slides = computed<SlideData[]>(() => {
    if (!slidesData.value || slidesData.value.length === 0) return [];

    return slidesData.value.map((slide, index) => {
      const port = devServerBasePort + index;
      const devServerUrl = `http://localhost:${port}`;
      const domain = IS_DEVELOPMENT ? devServerUrl : window.location.origin;

      const imageUrl = resolveImageUrl(slide, domain);

      // En production, l'URL doit inclure baseUrl ET un slash final.
      // Sans baseUrl le chemin est résolu relativement à la page (fragile derrière
      // un sous-chemin) ; sans slash final, le nginx du container répond par une
      // redirection 301 qui fuite son adresse interne (http://IP:8084/...),
      // ce qui casse l'iframe (Mixed Content + X-Frame-Options).
      const slideBase = pathJoin(slide.baseUrl, slide.path) + "/";
      const slideUrl = IS_DEVELOPMENT ? devServerUrl : slideBase;
      const presenterUrl = IS_DEVELOPMENT
        ? `${devServerUrl}/presenter/1`
        : `${slideBase}presenter/1`;

      return {
        id: slide.id,
        path: slide.path,
        title: slide.frontmatter.title || slide.path,
        url: slideUrl,
        presenterUrl,
        description:
          slide.frontmatter.info ||
          slide.frontmatter.seoMeta?.ogDescription ||
          "No description available",
        image: imageUrl,
        author: slide.frontmatter.author || "Unknown Author",
        date: slide.frontmatter.date || new Date().toISOString().split("T")[0],
        theme: slide.frontmatter.theme,
        transition: slide.frontmatter.transition,
        class: slide.frontmatter.class,
        category: slide.category,
        tags: slide.frontmatter.tags || [],
      };
    });
  });

  const slidesCount = computed(() => slides.value.length);

  function search(term: string): string[] {
    if (!miniSearch || !term) return [];
    return miniSearch.search(term).map((r) => r.id as string);
  }

  return {
    slides,
    slidesData,
    slidesCount,
    loadSlidesData,
    isLoading,
    search,
  };
}
