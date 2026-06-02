<template>
  <Card
    class="group hover:shadow-lg transition-all duration-200 cursor-pointer"
  >
    <a :href="url" target="_blank" class="flex flex-row">
      <!-- Thumbnail -->
      <div
        class="relative overflow-hidden rounded-l-xl flex-shrink-0"
        style="width: 240px; height: 135px"
      >
        <!-- Live iframe thumbnail (dev: separate port, prod: same-origin path) -->
        <div class="w-full h-full bg-muted overflow-hidden">
          <iframe
            :src="url"
            sandbox="allow-same-origin allow-scripts"
            loading="lazy"
            tabindex="-1"
            class="pointer-events-none border-0"
            style="
              width: 1280px;
              height: 720px;
              transform: scale(0.1875);
              transform-origin: top left;
            "
          />
        </div>
      </div>

      <!-- Content -->
      <div class="flex flex-col flex-1 min-w-0 px-4 py-3 gap-1">
        <CardTitle
          class="text-base font-semibold line-clamp-1 group-hover:text-primary transition-colors"
        >
          {{ title }}
        </CardTitle>

        <CardDescription class="line-clamp-2 text-xs leading-snug">
          {{ description }}
        </CardDescription>

        <!-- Tags -->
        <div v-if="tags && tags.length > 0" class="flex flex-wrap gap-1 mt-0.5">
          <span
            v-for="tag in tags"
            :key="tag"
            class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-primary/10 text-primary"
          >
            {{ tag }}
          </span>
        </div>

        <!-- Footer: meta + actions -->
        <div class="flex items-center justify-between mt-auto pt-1 gap-2">
          <div
            class="flex items-center gap-3 text-xs text-muted-foreground min-w-0"
          >
            <span class="flex items-center gap-1 truncate">
              <User class="h-3 w-3 flex-shrink-0" />
              <span class="truncate">{{ author }}</span>
            </span>
            <span class="flex items-center gap-1 flex-shrink-0">
              <Calendar class="h-3 w-3" />
              {{ date }}
            </span>
          </div>

          <!-- Action buttons -->
          <div class="flex items-center gap-1 flex-shrink-0" @click.stop>
            <a
              :href="presenterUrl"
              target="_blank"
              class="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md border border-border hover:bg-accent transition-colors"
              title="Mode présentateur"
            >
              <Monitor class="h-3 w-3" />
              Présenter
            </a>
            <a
              v-if="exports?.pdf"
              :href="exports.pdf"
              download
              class="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md border border-border hover:bg-accent transition-colors"
              title="Télécharger PDF"
            >
              <FileDown class="h-3 w-3" />
              PDF
            </a>
            <a
              v-if="exports?.pptx"
              :href="exports.pptx"
              download
              class="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md border border-border hover:bg-accent transition-colors"
              title="Télécharger PPTX"
            >
              <FileDown class="h-3 w-3" />
              PPTX
            </a>
            <button
              v-if="!exports?.pdf && !exports?.pptx"
              disabled
              class="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md border border-border opacity-40 cursor-not-allowed"
              title="Aucun export généré"
            >
              <FileDown class="h-3 w-3" />
            </button>
            <button
              type="button"
              class="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md border border-border hover:bg-accent transition-colors"
              title="Éditer les tags"
              @click.stop="emit('edit-tags')"
            >
              <Tag class="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>
    </a>
  </Card>
</template>

<script setup lang="ts">
import { Calendar, User, Monitor, FileDown, Tag } from "lucide-vue-next";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";

defineProps<{
  title: string;
  image?: string;
  description?: string;
  url: string;
  presenterUrl: string;
  author: string;
  date: string;
  tags?: string[];
  exports?: { pdf?: string; pptx?: string };
}>();

const emit = defineEmits<{ "edit-tags": [] }>();
</script>
