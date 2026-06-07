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

            <!-- Export dropdown (production only) -->
            <PopoverRoot v-if="!IS_DEVELOPMENT">
              <PopoverTrigger as-child>
                <button
                  type="button"
                  class="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md border border-border hover:bg-accent transition-colors"
                  :disabled="!!activeExport"
                  :title="
                    activeExport
                      ? 'Export en cours…'
                      : 'Exporter la présentation'
                  "
                >
                  <Loader2 v-if="activeExport" class="h-3 w-3 animate-spin" />
                  <FileDown v-else class="h-3 w-3" />
                  Export
                  <ChevronDown class="h-2 w-2 opacity-60" />
                </button>
              </PopoverTrigger>
              <PopoverPortal>
                <PopoverContent
                  class="z-50 w-56 rounded-lg border border-border bg-background shadow-lg p-1.5 space-y-0.5"
                  :side-offset="4"
                  align="end"
                  @open-auto-focus.prevent
                >
                  <!-- Light mode section -->
                  <p
                    class="px-2 py-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground"
                  >
                    ☀️ Light
                  </p>

                  <ExportRow
                    label="PDF"
                    :download-url="pdfUrl"
                    :is-loading="activeExport === 'pdf'"
                    icon-color="text-red-500"
                    @generate="triggerDownload('pdf')"
                    @download="downloadFile(pdfUrl!)"
                  />
                  <ExportRow
                    label="PPTX (éditable)"
                    :download-url="pptxUrl"
                    :is-loading="activeExport === 'pptx'"
                    icon-color="text-orange-500"
                    @generate="triggerDownload('pptx')"
                    @download="downloadFile(pptxUrl!)"
                  />

                  <!-- Dark mode section -->
                  <p
                    class="px-2 py-1 mt-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground"
                  >
                    🌙 Dark
                  </p>

                  <ExportRow
                    label="PDF (dark)"
                    :download-url="pdfDarkUrl"
                    :is-loading="activeExport === 'pdf-dark'"
                    icon-color="text-blue-500"
                    @generate="triggerDownload('pdf-dark')"
                    @download="downloadFile(pdfDarkUrl!)"
                  />
                  <ExportRow
                    label="PPTX (dark)"
                    :download-url="pptxDarkUrl"
                    :is-loading="activeExport === 'pptx-dark'"
                    icon-color="text-purple-500"
                    @generate="triggerDownload('pptx-dark')"
                    @download="downloadFile(pptxDarkUrl!)"
                  />

                  <!-- Watermark section -->
                  <p
                    class="px-2 py-1 mt-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground"
                  >
                    🔒 Filigrane
                  </p>

                  <!-- Watermark text input -->
                  <div class="px-2 pb-1">
                    <input
                      v-model="watermarkText"
                      type="text"
                      placeholder="Texte du filigrane"
                      class="w-full text-xs px-2 py-1 rounded border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                      @click.stop
                    />
                  </div>

                  <ExportRow
                    label="PDF avec filigrane"
                    :download-url="null"
                    :is-loading="activeExport === 'pdf-watermark'"
                    icon-color="text-yellow-600"
                    always-generate
                    @generate="triggerDownload('pdf-watermark')"
                    @download="triggerDownload('pdf-watermark')"
                  />

                  <!-- Error message -->
                  <p
                    v-if="exportError"
                    class="px-2 py-1 text-[10px] text-red-500"
                  >
                    {{ exportError }}
                  </p>
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
  ChevronDown,
  Loader2,
} from "lucide-vue-next";
import {
  PopoverRoot,
  PopoverTrigger,
  PopoverContent,
  PopoverPortal,
} from "reka-ui";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { IS_DEVELOPMENT } from "@/constants/env";
import { triggerExport } from "@/composables/useSlides";
import ExportRow from "./ExportRow.vue";

type ExportFormat = "pdf" | "pptx" | "pdf-dark" | "pptx-dark" | "pdf-watermark";

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
  pdfUrl: string | null;
  pdfDarkUrl: string | null;
  pptxUrl: string | null;
  pptxDarkUrl: string | null;
}>();

const emit = defineEmits<{ "edit-tags": [] }>();

const activeExport = ref<ExportFormat | null>(null);
const exportError = ref<string | null>(null);
const watermarkText = ref("CONFIDENTIEL");

function openSlide() {
  window.open(props.url, "_blank");
}

function openPresenter() {
  window.open(props.presenterUrl, "_blank");
  window.open(props.url, "_blank");
}

function downloadFile(url: string) {
  const a = document.createElement("a");
  a.href = url;
  a.target = "_blank";
  a.click();
}

async function triggerDownload(format: ExportFormat) {
  if (activeExport.value) return;

  exportError.value = null;
  activeExport.value = format;

  try {
    const fileUrl = await triggerExport(
      props.slidePath,
      format,
      format === "pdf-watermark" ? watermarkText.value : undefined,
    );
    downloadFile(fileUrl);
  } catch (err) {
    exportError.value = String(err).replace(/^Error:\s*/, "");
  } finally {
    activeExport.value = null;
  }
}
</script>
