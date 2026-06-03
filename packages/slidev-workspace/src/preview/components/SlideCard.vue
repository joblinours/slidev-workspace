<template>
  <Card
    class="group hover:shadow-lg transition-all duration-200 cursor-pointer"
    @click="openSlide"
  >
    <div class="flex flex-row">
      <!-- Thumbnail — #/1 forces slide 1 in Slidev's hash router -->
      <div
        class="relative overflow-hidden rounded-l-xl flex-shrink-0 bg-muted"
        style="width: 240px; height: 135px"
      >
        <!--
          allow-same-origin is needed so the iframe can load its own assets
          (JS/CSS) from the same origin. Without it the iframe origin is null
          and all sub-resources are blocked by CORS.
          #/1 in the src forces Slidev's hash router to slide 1, overriding
          any localStorage-persisted position.
        -->
        <iframe
          :src="`${url}#/1`"
          sandbox="allow-scripts allow-same-origin"
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

        <!-- Footer: meta + actions -->
        <div class="flex items-center justify-between mt-auto pt-1 gap-2">
          <div
            class="flex items-center gap-2 text-xs text-muted-foreground min-w-0 flex-wrap"
          >
            <span class="flex items-center gap-1 truncate">
              <User class="h-3 w-3 flex-shrink-0" />
              <span class="truncate">{{ author }}</span>
            </span>
            <span class="flex items-center gap-1 flex-shrink-0">
              <Calendar class="h-3 w-3" />
              {{ date }}
            </span>
            <!-- Tags inline with author/date -->
            <span
              v-for="tag in tags"
              :key="tag"
              class="inline-flex items-center rounded-full px-2 py-0.5 font-medium bg-primary/10 text-primary flex-shrink-0"
            >
              {{ tag }}
            </span>
          </div>

          <!-- Action buttons — @click.stop prevents card navigation -->
          <div class="flex items-center gap-1 flex-shrink-0" @click.stop>
            <button
              type="button"
              class="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md border border-border hover:bg-accent transition-colors"
              title="Mode présentateur"
              @click="openPresenter"
            >
              <Monitor class="h-3 w-3" />
              Présenter
            </button>
            <button
              v-if="exports?.pdf"
              type="button"
              class="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md border border-border hover:bg-accent transition-colors"
              title="Télécharger PDF"
              @click="downloadUrl(exports.pdf!)"
            >
              <FileDown class="h-3 w-3" />
              PDF
            </button>
            <button
              v-if="exports?.pptx"
              type="button"
              class="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md border border-border hover:bg-accent transition-colors"
              title="Télécharger PPTX"
              @click="downloadUrl(exports.pptx!)"
            >
              <FileDown class="h-3 w-3" />
              PPTX
            </button>
            <button
              v-if="!exports?.pdf && !exports?.pptx"
              type="button"
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
              @click="emit('edit-tags')"
            >
              <Tag class="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
  </Card>
</template>

<script setup lang="ts">
import { Calendar, User, Monitor, FileDown, Tag } from "lucide-vue-next";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";

const props = defineProps<{
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

function openSlide() {
  window.open(props.url, "_blank");
}

function openPresenter() {
  window.open(props.presenterUrl, "_blank");
  window.open(props.url, "_blank");
}

function downloadUrl(url: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = "";
  a.click();
}
</script>
