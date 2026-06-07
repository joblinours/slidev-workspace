<template>
  <div class="flex items-center gap-1 w-full px-1">
    <!-- Download button (file exists) -->
    <button
      v-if="downloadUrl && !alwaysGenerate"
      type="button"
      class="flex-1 flex items-center gap-2 text-xs px-2 py-1.5 rounded-md hover:bg-accent transition-colors text-left"
      :disabled="isLoading"
      @click.stop="emit('download')"
    >
      <FileDown :class="['h-3 w-3 flex-shrink-0', iconColor]" />
      {{ label }}
    </button>

    <!-- Generate button (file missing or alwaysGenerate) -->
    <button
      v-else
      type="button"
      class="flex-1 flex items-center gap-2 text-xs px-2 py-1.5 rounded-md hover:bg-accent transition-colors text-left"
      :disabled="isLoading"
      @click.stop="emit('generate')"
    >
      <Loader2
        v-if="isLoading"
        :class="['h-3 w-3 flex-shrink-0 animate-spin', iconColor]"
      />
      <FileDown v-else :class="['h-3 w-3 flex-shrink-0', iconColor]" />
      <span>{{ isLoading ? "Génération…" : label }}</span>
    </button>

    <!-- Re-generate button (file exists, allow re-generate) -->
    <button
      v-if="downloadUrl && !alwaysGenerate"
      type="button"
      class="flex-shrink-0 flex items-center p-1.5 rounded-md hover:bg-accent transition-colors text-muted-foreground"
      :disabled="isLoading"
      title="Re-générer"
      @click.stop="emit('generate')"
    >
      <RefreshCw v-if="!isLoading" class="h-3 w-3" />
      <Loader2 v-else class="h-3 w-3 animate-spin" />
    </button>
  </div>
</template>

<script setup lang="ts">
import { FileDown, Loader2, RefreshCw } from "lucide-vue-next";

defineProps<{
  label: string;
  downloadUrl: string | null;
  isLoading: boolean;
  iconColor?: string;
  alwaysGenerate?: boolean;
}>();

const emit = defineEmits<{
  generate: [];
  download: [];
}>();
</script>
