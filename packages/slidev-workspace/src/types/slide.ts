export interface SlideFrontmatter {
  theme?: string;
  background?: string;
  title?: string;
  info?: string;
  class?: string;
  drawings?: {
    persist?: boolean;
  };
  transition?: string;
  mdc?: boolean;
  seoMeta?: {
    ogImage?: string;
    ogTitle?: string;
    ogDescription?: string;
  };
  author?: string;
  date?: string;
  tags?: string[];
}

export interface SlideInfo {
  id: string;
  path: string;
  fullPath: string;
  sourceDir: string;
  /** Category derived from folder structure (optional). */
  category?: string;
  frontmatter: SlideFrontmatter;
  content: string;
  /** The base URL of the slide, which is defined in slidev-workspace.yml */
  baseUrl: string;
  /** Whether og-image.png exists in the slide directory */
  hasOgImage: boolean;
}

export interface SlideData {
  id: string;
  path: string;
  title: string;
  url: string;
  presenterUrl: string;
  description: string;
  image: string;
  author: string;
  date: string;
  theme?: string;
  transition?: string;
  class?: string;
  category?: string;
  tags: string[];
}
