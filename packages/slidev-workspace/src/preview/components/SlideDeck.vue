<template>
  <div
    class="min-h-screen bg-gradient-to-br from-gray-100 via-white to-gray-200 dark:from-gray-900 dark:via-gray-950 dark:to-black py-16 px-4 transition-colors"
  >
    <div class="max-w-6xl mx-auto">
      <div class="mb-8 flex justify-between items-start">
        <div>
          <h1 class="text-3xl font-bold mb-2">{{ hero.title }}</h1>
          <p class="text-muted-foreground">
            {{ hero.description }}
          </p>
        </div>
        <button
          @click="toggleDarkMode"
          class="p-2 rounded-lg hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors cursor-pointer"
          aria-label="Toggle dark mode"
          type="button"
        >
          <Moon v-if="!isDark" class="size-6" />
          <Sun v-else class="size-6" />
        </button>
      </div>

      <div class="grid gap-8 lg:grid-cols-[240px_1fr]">
        <aside class="order-2 lg:order-1">
          <div
            class="rounded-xl border bg-sidebar text-sidebar-foreground shadow-sm"
          >
            <div class="px-4 pt-4 pb-2">
              <h2 class="text-xs font-semibold uppercase tracking-widest">
                Categories
              </h2>
            </div>
            <div class="px-2 pb-3 space-y-1">
              <button
                v-for="category in categoryOptions"
                :key="category.name"
                type="button"
                @click="selectedCategory = category.name"
                class="w-full flex items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors"
                :class="
                  selectedCategory === category.name
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                    : 'hover:bg-sidebar-accent/70 text-sidebar-foreground'
                "
              >
                <span class="truncate">{{ category.name }}</span>
                <span class="text-xs text-muted-foreground">{{
                  category.count
                }}</span>
              </button>
            </div>
          </div>
        </aside>

        <section class="order-1 lg:order-2">
          <div class="space-y-4 mb-8">
            <div class="relative w-full">
              <Input
                class="pl-10"
                placeholder="Search by title, description, or author..."
                v-model="searchTerm"
              />
              <span
                class="absolute start-0 inset-y-0 flex items-center justify-center px-2"
              >
                <Search class="size-6 text-muted-foreground/30" />
              </span>
            </div>
          </div>

          <div class="mb-6 flex items-center justify-between">
            <p class="text-sm text-muted-foreground">
              Found {{ filteredSlides.length }} of {{ slidesCount }} slides
              <template v-if="searchTerm">
                <span>
                  containing "
                  <span class="font-medium">{{ searchTerm }}</span>
                  "
                </span>
              </template>
            </p>
            <p class="text-xs text-muted-foreground">
              Category: <span class="font-medium">{{ selectedCategory }}</span>
            </p>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8">
            <SlideCard
              v-for="slide in filteredSlides"
              :key="slide.title"
              :title="slide.title"
              :image="slide.image"
              :description="slide.description"
              :url="slide.url"
              :author="slide.author"
              :date="slide.date"
            />
          </div>
        </section>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { Search, Moon, Sun } from "lucide-vue-next";

import { useSlides } from "../composables/useSlides";
import { useConfig } from "../composables/useConfig";
import { useDarkMode } from "../composables/useDarkMode";
import { Input } from "../components/ui/input";
import SlideCard from "./SlideCard.vue";

const searchTerm = ref("");
const { slides, slidesCount } = useSlides();
const { hero } = useConfig();
const { isDark, toggleDarkMode } = useDarkMode();

const uncategorizedLabel = "Uncategorized";
const selectedCategory = ref("All");

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

  return [
    {
      name: "All",
      count: slidesCount.value,
    },
    ...categories,
  ];
});

watch(categoryOptions, (next) => {
  const hasSelected = next.some(
    (category) => category.name === selectedCategory.value,
  );
  if (!hasSelected) {
    selectedCategory.value = "All";
  }
});

const filteredSlides = computed(() => {
  let result = slides.value;

  if (selectedCategory.value !== "All") {
    result = result.filter(
      (slide) =>
        (slide.category || uncategorizedLabel) === selectedCategory.value,
    );
  }

  if (!searchTerm.value) return result;
  return result.filter(
    (slide) =>
      slide.title.toLowerCase().includes(searchTerm.value.toLowerCase()) ||
      slide.description
        .toLowerCase()
        .includes(searchTerm.value.toLowerCase()) ||
      slide.author.toLowerCase().includes(searchTerm.value.toLowerCase()),
  );
});
</script>
