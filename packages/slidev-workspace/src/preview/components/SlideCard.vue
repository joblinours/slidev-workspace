<template>
  <Card
    class="group hover:shadow-lg transition-all duration-200 cursor-pointer flex flex-col"
  >
    <a :href="url" target="_blank" class="flex-1 flex flex-col">
      <div class="relative overflow-hidden rounded-t-lg">
        <Skeleton
          v-if="isLoading && image"
          class="w-full h-48 rounded-b-none"
        />
        <img
          v-if="image"
          ref="imageRef"
          v-show="!isLoading"
          :src="image"
          :alt="title"
          class="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-200"
          @load="onImageLoad"
          @error="onImageError"
        />
        <div
          v-if="!image"
          class="w-full h-48 bg-muted flex items-center justify-center"
        >
          <span class="text-muted-foreground">No Image</span>
        </div>
      </div>

      <CardHeader class="pb-2">
        <CardTitle
          class="text-lg line-clamp-2 group-hover:text-primary transition-colors"
        >
          {{ title }}
        </CardTitle>
      </CardHeader>

      <CardContent class="space-y-3 flex-1">
        <CardDescription class="line-clamp-3 text-sm h-[40px]">
          {{ description }}
        </CardDescription>

        <!-- Tags -->
        <div v-if="tags && tags.length > 0" class="flex flex-wrap gap-1">
          <span
            v-for="tag in tags"
            :key="tag"
            class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-primary/10 text-primary"
          >
            {{ tag }}
          </span>
        </div>

        <div
          class="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t"
        >
          <div class="flex items-center gap-1">
            <User class="h-3 w-3" />
            <span>{{ author }}</span>
          </div>
          <div class="flex items-center gap-1">
            <Calendar class="h-3 w-3" />
            <span>{{ date }}</span>
          </div>
        </div>
      </CardContent>
    </a>

    <!-- Actions: Presenter mode + Exports -->
    <div class="px-6 pb-4 pt-0 flex items-center gap-2 flex-wrap border-t mt-2">
      <a
        :href="presenterUrl"
        target="_blank"
        class="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md border border-border hover:bg-accent transition-colors"
        title="Open in presenter mode"
        @click.stop
      >
        <Monitor class="h-3 w-3" />
        Présenter
      </a>
      <a
        v-if="exports?.pdf"
        :href="exports.pdf"
        download
        class="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md border border-border hover:bg-accent transition-colors"
        title="Download PDF"
        @click.stop
      >
        <FileDown class="h-3 w-3" />
        PDF
      </a>
      <a
        v-if="exports?.pptx"
        :href="exports.pptx"
        download
        class="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md border border-border hover:bg-accent transition-colors"
        title="Download PPTX"
        @click.stop
      >
        <FileDown class="h-3 w-3" />
        PPTX
      </a>
    </div>
  </Card>
</template>

<script setup lang="ts">
import { ref, useTemplateRef } from "vue";
import { Calendar, User, Monitor, FileDown } from "lucide-vue-next";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

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

defineEmits<{ click: [] }>();

const imageRef = useTemplateRef<HTMLImageElement>("imageRef");
const isLoading = ref(true);
const retryCount = ref(0);

const MAX_RETRIES = 5;
const RETRY_DELAY = 1000;

const onImageLoad = () => {
  isLoading.value = false;
};

const onImageError = () => {
  if (retryCount.value < MAX_RETRIES) {
    retryCount.value++;
    setTimeout(() => {
      if (imageRef.value && props.image) {
        imageRef.value.src = props.image;
      }
    }, RETRY_DELAY);
  } else {
    isLoading.value = false;
  }
};
</script>
