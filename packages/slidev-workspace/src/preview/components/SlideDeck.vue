<template>
  <div class="min-h-screen transition-colors sw-page">
    <div class="w-full max-w-[1400px] mx-auto">
      <!-- Header -->
      <header class="px-6 py-8 lg:px-12 lg:py-10">
        <!-- Title row + dark mode toggle -->
        <div class="flex items-start justify-between gap-4 mb-6">
          <div>
            <h1 class="text-3xl font-semibold">{{ hero.title }}</h1>
            <p class="mt-2 text-sm text-muted-foreground">
              {{ hero.description }}
            </p>
          </div>
          <button
            @click="toggleDarkMode"
            class="p-2 rounded-lg hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors cursor-pointer flex-shrink-0 mt-1"
            aria-label="Toggle dark mode"
            type="button"
          >
            <Moon v-if="!isDark" class="size-5" />
            <Sun v-else class="size-5" />
          </button>
        </div>

        <!-- Search bar + filter button -->
        <div class="flex items-center gap-2 mb-3">
          <div class="relative flex-1 max-w-xl">
            <Input
              class="pl-10 h-10 rounded-xl bg-background/70"
              placeholder="Rechercher des présentations..."
              v-model="searchTerm"
            />
            <span
              class="absolute start-0 inset-y-0 flex items-center justify-center px-3"
            >
              <Search class="size-5 text-muted-foreground/50" />
            </span>
          </div>

          <!-- Filter popover -->
          <PopoverRoot v-model:open="filterOpen">
            <PopoverTrigger as-child>
              <button
                type="button"
                class="inline-flex items-center gap-2 h-10 px-3 rounded-xl border border-border bg-background hover:bg-accent transition-colors text-sm font-medium relative"
              >
                <SlidersHorizontal class="size-4" />
                Filtres
                <span
                  v-if="activeFilterCount > 0"
                  class="absolute -top-1.5 -right-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-primary text-primary-foreground text-[10px] font-bold"
                  >{{ activeFilterCount }}</span
                >
              </button>
            </PopoverTrigger>
            <PopoverPortal>
              <PopoverContent
                class="z-50 w-72 rounded-xl border border-border bg-background shadow-lg p-4 space-y-4"
                :side-offset="8"
                align="end"
              >
                <!-- Sort -->
                <div>
                  <h4
                    class="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2"
                  >
                    Tri
                  </h4>
                  <div class="space-y-1">
                    <label
                      v-for="opt in sortOptions"
                      :key="opt.value"
                      class="flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer text-sm hover:bg-accent transition-colors"
                    >
                      <input
                        type="radio"
                        :value="opt.value"
                        v-model="sortOrder"
                        class="accent-primary"
                      />
                      {{ opt.label }}
                    </label>
                  </div>
                </div>

                <!-- Tag filter -->
                <div v-if="tagOptions.length > 0">
                  <h4
                    class="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2"
                  >
                    Tag
                  </h4>
                  <select
                    v-model="selectedTag"
                    class="w-full h-9 rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="All">Tous les tags</option>
                    <option
                      v-for="tag in tagOptions"
                      :key="tag.name"
                      :value="tag.name"
                    >
                      {{ tag.name }} ({{ tag.count }})
                    </option>
                  </select>
                </div>

                <!-- Category filter -->
                <div v-if="categoryOptions.length > 1">
                  <h4
                    class="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2"
                  >
                    Catégorie
                  </h4>
                  <select
                    v-model="selectedCategory"
                    class="w-full h-9 rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="All">Toutes les catégories</option>
                    <option
                      v-for="cat in categoryOptions.filter(
                        (c) => c.name !== 'All',
                      )"
                      :key="cat.name"
                      :value="cat.name"
                    >
                      {{ cat.name }} ({{ cat.count }})
                    </option>
                  </select>
                </div>

                <!-- Reset -->
                <button
                  v-if="activeFilterCount > 0"
                  type="button"
                  @click="resetFilters"
                  class="w-full text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
                >
                  Réinitialiser les filtres
                </button>
              </PopoverContent>
            </PopoverPortal>
          </PopoverRoot>
        </div>

        <!-- Count -->
        <p class="text-sm text-muted-foreground">
          {{ filteredSlides.length }} présentation{{
            filteredSlides.length !== 1 ? "s" : ""
          }}
          trouvée{{ filteredSlides.length !== 1 ? "s" : "" }}
          <template v-if="filteredSlides.length !== slidesCount">
            sur {{ slidesCount }}</template
          >
          <template v-if="searchTerm">
            contenant "<span class="font-medium">{{ searchTerm }}</span
            >"
          </template>
        </p>
      </header>

      <!-- Cards -->
      <section class="px-6 pb-12 lg:px-12">
        <div class="flex flex-col gap-3">
          <SlideCard
            v-for="slide in filteredSlides"
            :key="slide.id"
            :title="slide.title"
            :image="slide.image"
            :description="slide.description"
            :url="slide.url"
            :presenter-url="slide.presenterUrl"
            :slide-path="slide.path"
            :author="slide.author"
            :date="slide.date"
            :tags="slide.tags"
            :pdf-url="slide.pdfUrl"
            :pptx-url="slide.pptxUrl"
            @edit-tags="openTagEditor(slide)"
          />
        </div>
      </section>
    </div>

    <!-- Tag editor modal -->
    <TagEditor
      v-if="editingSlide"
      :slide-path="editingSlide.path"
      :initial-tags="editingSlide.tags"
      @close="editingSlide = null"
      @saved="onTagsSaved"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { Moon, Sun, Search, SlidersHorizontal } from "lucide-vue-next";
import {
  PopoverRoot,
  PopoverTrigger,
  PopoverContent,
  PopoverPortal,
} from "reka-ui";

import { useSlides } from "../composables/useSlides";
import { useConfig } from "../composables/useConfig";
import { useDarkMode } from "../composables/useDarkMode";
import { IS_DEVELOPMENT } from "../constants/env";
import { Input } from "../components/ui/input";
import SlideCard from "./SlideCard.vue";
import TagEditor from "./TagEditor.vue";
import type { SlideData } from "../../types/slide";

const searchTerm = ref("");
const filterOpen = ref(false);
const { slides, slidesCount, search, loadSlidesData } = useSlides();
const { hero } = useConfig();
const { isDark, toggleDarkMode } = useDarkMode();

const uncategorizedLabel = "Uncategorized";
const selectedCategory = ref("All");
const selectedTag = ref("All");
const sortOrder = ref<"date-desc" | "date-asc" | "name-asc" | "name-desc">(
  "date-desc",
);
const editingSlide = ref<SlideData | null>(null);

const sortOptions = [
  { value: "date-desc", label: "Date (plus récent)" },
  { value: "date-asc", label: "Date (plus ancien)" },
  { value: "name-asc", label: "Nom A→Z" },
  { value: "name-desc", label: "Nom Z→A" },
] as const;

const categoryOptions = computed(() => {
  const counts = new Map<string, number>();
  slides.value.forEach((slide) => {
    const category = slide.category || uncategorizedLabel;
    counts.set(category, (counts.get(category) || 0) + 1);
  });

  const categories = Array.from(counts.entries()).map(([name, count]) => ({
    name,
    count,
  }));

  if (categories.length <= 1) {
    return [{ name: "All", count: slidesCount.value }];
  }

  return [{ name: "All", count: slidesCount.value }, ...categories];
});

const tagOptions = computed(() => {
  const counts = new Map<string, number>();
  slides.value.forEach((slide) => {
    (slide.tags || []).forEach((tag) => {
      counts.set(tag, (counts.get(tag) || 0) + 1);
    });
  });
  return Array.from(counts.entries()).map(([name, count]) => ({ name, count }));
});

const activeFilterCount = computed(() => {
  let count = 0;
  if (sortOrder.value !== "date-desc") count++;
  if (selectedTag.value !== "All") count++;
  if (selectedCategory.value !== "All") count++;
  return count;
});

watch(categoryOptions, (next) => {
  const hasSelected = next.some((c) => c.name === selectedCategory.value);
  if (!hasSelected) selectedCategory.value = "All";
});

watch(tagOptions, (next) => {
  const hasSelected = next.some((t) => t.name === selectedTag.value);
  if (!hasSelected) selectedTag.value = "All";
});

const filteredSlides = computed(() => {
  let result = slides.value;

  if (selectedCategory.value !== "All") {
    result = result.filter(
      (slide) =>
        (slide.category || uncategorizedLabel) === selectedCategory.value,
    );
  }

  if (selectedTag.value !== "All") {
    result = result.filter((slide) =>
      (slide.tags || []).includes(selectedTag.value),
    );
  }

  if (searchTerm.value) {
    const hitIds = new Set(search(searchTerm.value));
    result = result.filter((slide) => hitIds.has(slide.id));
  }

  // Sort
  result = [...result].sort((a, b) => {
    switch (sortOrder.value) {
      case "date-asc":
        return (a.date || "").localeCompare(b.date || "");
      case "date-desc":
        return (b.date || "").localeCompare(a.date || "");
      case "name-asc":
        return a.title.localeCompare(b.title);
      case "name-desc":
        return b.title.localeCompare(a.title);
    }
  });

  return result;
});

function resetFilters() {
  sortOrder.value = "date-desc";
  selectedTag.value = "All";
  selectedCategory.value = "All";
}

function openTagEditor(slide: SlideData) {
  editingSlide.value = slide;
}

async function onTagsSaved() {
  editingSlide.value = null;
  if (IS_DEVELOPMENT) {
    // Dev: HMR will push updated slidev:content automatically
    await loadSlidesData();
  } else {
    // Prod: slidev:content is a static bundle — reload to pick up cron rebuild
    window.location.reload();
  }
}
</script>
