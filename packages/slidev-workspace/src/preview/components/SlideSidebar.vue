<template>
  <div :class="containerClass">
    <div class="px-1 pb-4">
      <h2 class="text-lg font-semibold tracking-tight">
        {{ title }}
      </h2>
    </div>

    <div class="px-1 pb-6">
      <div class="relative w-full">
        <Input
          class="pl-10 h-10 rounded-xl bg-background/70"
          placeholder="Search slides..."
          v-model="searchTerm"
        />
        <span
          class="absolute start-0 inset-y-0 flex items-center justify-center px-3"
        >
          <Search class="size-5 text-muted-foreground/50" />
        </span>
      </div>
    </div>

    <div class="px-1 pb-2">
      <h3
        class="text-xs font-semibold uppercase tracking-widest text-muted-foreground"
      >
        Categories
      </h3>
    </div>

    <div :class="categoriesClass">
      <button
        v-for="category in categories"
        :key="category.name"
        type="button"
        @click="selectedCategory = category.name"
        class="w-full flex items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition-colors"
        :class="
          selectedCategory === category.name
            ? 'bg-sidebar-accent text-sidebar-accent-foreground ring-1 ring-sidebar-border/70 shadow-sm dark:ring-sidebar-border/30'
            : 'hover:bg-sidebar-accent/70 text-sidebar-foreground'
        "
      >
        <span class="truncate">{{ category.name }}</span>
        <span class="text-xs text-muted-foreground">{{ category.count }}</span>
      </button>
    </div>

    <div class="mt-auto flex items-center justify-between gap-3 pt-6">
      <a
        v-if="githubUrl"
        :href="githubUrl"
        target="_blank"
        rel="noreferrer"
        class="inline-flex items-center justify-center rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors cursor-pointer"
        aria-label="Open GitHub repository"
      >
        <Github class="size-5" />
      </a>
      <div v-else />
      <button
        @click="emit('toggle-dark', $event)"
        class="p-2 rounded-lg hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors cursor-pointer"
        aria-label="Toggle dark mode"
        type="button"
      >
        <Moon v-if="!isDark" class="size-5" />
        <Sun v-else class="size-5" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { Github, Moon, Search, Sun } from "lucide-vue-next";

import { Input } from "../components/ui/input";

interface CategoryOption {
  name: string;
  count: number;
}

const props = withDefaults(
  defineProps<{
    title: string;
    githubUrl?: string;
    categories: CategoryOption[];
    isDark: boolean;
    variant?: "desktop" | "drawer";
  }>(),
  {
    variant: "desktop",
  },
);

const emit = defineEmits<{
  (e: "toggle-dark", event: MouseEvent): void;
}>();

const searchTerm = defineModel<string>("searchTerm", { default: "" });
const selectedCategory = defineModel<string>("selectedCategory", {
  default: "All",
});

const containerClass = computed(() =>
  props.variant === "drawer"
    ? "flex h-full flex-col px-6 py-8 text-sidebar-foreground"
    : "sticky top-0 flex h-screen w-[270px] flex-col px-6 py-10 text-sidebar-foreground",
);

const categoriesClass = computed(() =>
  props.variant === "drawer"
    ? "px-0.5 pb-2 space-y-1 flex-1 overflow-auto"
    : "px-0.5 pb-2 space-y-1 max-h-[60vh] overflow-auto",
);
</script>
