<template>
  <Card
    class="group hover:shadow-lg transition-all duration-200 cursor-pointer"
    @click="openSlide"
  >
    <div class="flex flex-row">
      <!-- Thumbnail -->
      <div
        class="relative overflow-hidden rounded-l-xl flex-shrink-0 bg-muted"
        style="width: 240px; height: 135px"
      >
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
            <span
              v-for="tag in tags"
              :key="tag"
              class="inline-flex items-center rounded-full px-2 py-0.5 font-medium bg-primary/10 text-primary flex-shrink-0"
            >
              {{ tag }}
            </span>
          </div>

          <!-- Action buttons -->
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

            <!-- Export dropdown -->
            <PopoverRoot v-model:open="exportOpen">
              <PopoverTrigger as-child>
                <button
                  type="button"
                  class="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md border border-border hover:bg-accent transition-colors"
                  :class="{
                    'opacity-60 cursor-wait': exportLoading !== null,
                    'border-destructive text-destructive': exportError,
                  }"
                  :disabled="exportLoading !== null"
                  :title="exportError ?? 'Exporter la présentation'"
                  @click="exportError = null"
                >
                  <Loader2 v-if="exportLoading" class="h-3 w-3 animate-spin" />
                  <FileDown v-else class="h-3 w-3" />
                  {{
                    exportLoading
                      ? `Export ${exportLoading.toUpperCase()}…`
                      : "Export"
                  }}
                  <ChevronDown class="h-2 w-2 opacity-60" />
                </button>
              </PopoverTrigger>
              <PopoverPortal>
                <PopoverContent
                  class="z-50 w-48 rounded-lg border border-border bg-background shadow-lg p-1.5 space-y-0.5"
                  :side-offset="4"
                  align="end"
                  @open-auto-focus.prevent
                >
                  <p
                    class="px-2 py-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground"
                  >
                    Exporter
                  </p>

                  <button
                    type="button"
                    class="w-full flex items-center gap-2 text-xs px-2 py-1.5 rounded-md hover:bg-accent transition-colors text-left"
                    @click="triggerExport('pdf')"
                  >
                    <FileDown class="h-3 w-3 text-red-500" />
                    Télécharger PDF
                  </button>

                  <button
                    type="button"
                    class="w-full flex items-center gap-2 text-xs px-2 py-1.5 rounded-md hover:bg-accent transition-colors text-left"
                    @click="triggerExport('pptx')"
                  >
                    <FileDown class="h-3 w-3 text-orange-500" />
                    Télécharger PPTX
                  </button>

                  <div
                    v-if="exportError"
                    class="px-2 py-1 text-[10px] text-destructive leading-snug"
                  >
                    {{ exportError }}
                  </div>
                </PopoverContent>
              </PopoverPortal>
            </PopoverRoot>

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
import { ref } from "vue";
import {
  Calendar,
  User,
  Monitor,
  FileDown,
  Tag,
  Loader2,
  ChevronDown,
} from "lucide-vue-next";
import {
  PopoverRoot,
  PopoverTrigger,
  PopoverContent,
  PopoverPortal,
} from "reka-ui";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";

const props = defineProps<{
  title: string;
  image?: string;
  description?: string;
  url: string;
  presenterUrl: string;
  slidePath: string;
  author: string;
  date: string;
  tags?: string[];
}>();

const emit = defineEmits<{ "edit-tags": [] }>();

const exportOpen = ref(false);
const exportLoading = ref<"pdf" | "pptx" | null>(null);
const exportError = ref<string | null>(null);

function openSlide() {
  window.open(props.url, "_blank");
}

function openPresenter() {
  window.open(props.presenterUrl, "_blank");
  window.open(props.url, "_blank");
}

async function triggerExport(format: "pdf" | "pptx") {
  exportOpen.value = false;
  exportLoading.value = format;
  exportError.value = null;

  try {
    const apiUrl =
      `${import.meta.env.BASE_URL}api/slides/export` +
      `?path=${encodeURIComponent(props.slidePath)}&format=${format}`;

    const response = await fetch(apiUrl);

    if (!response.ok) {
      const msg = await response.text();
      throw new Error(msg || `HTTP ${response.status}`);
    }

    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = `${props.title}.${format}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(blobUrl);
  } catch (err) {
    exportError.value = err instanceof Error ? err.message : String(err);
    exportOpen.value = true;
  } finally {
    exportLoading.value = null;
  }
}
</script>
