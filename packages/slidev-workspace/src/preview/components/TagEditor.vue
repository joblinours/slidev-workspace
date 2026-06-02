<template>
  <!-- Backdrop -->
  <div
    class="fixed inset-0 z-50 flex items-center justify-center"
    @keydown.esc="emit('close')"
  >
    <div class="absolute inset-0 bg-black/50" @click="emit('close')" />

    <!-- Modal -->
    <div
      class="relative bg-background rounded-xl shadow-xl border border-border p-6 w-full max-w-md mx-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tag-editor-title"
    >
      <div class="flex items-center justify-between mb-4">
        <h2 id="tag-editor-title" class="text-base font-semibold">
          Éditer les tags
        </h2>
        <button
          type="button"
          class="p-1.5 rounded-lg hover:bg-accent transition-colors text-muted-foreground"
          @click="emit('close')"
        >
          <X class="h-4 w-4" />
        </button>
      </div>

      <!-- Current tags -->
      <div class="mb-3">
        <p class="text-xs text-muted-foreground mb-2">Tags actuels</p>
        <div v-if="currentTags.length > 0" class="flex flex-wrap gap-1.5">
          <span
            v-for="tag in currentTags"
            :key="tag"
            class="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium bg-primary/10 text-primary"
          >
            {{ tag }}
            <button
              type="button"
              class="hover:text-destructive transition-colors"
              @click="removeTag(tag)"
              :aria-label="`Supprimer le tag ${tag}`"
            >
              <X class="h-3 w-3" />
            </button>
          </span>
        </div>
        <p v-else class="text-xs text-muted-foreground italic">Aucun tag</p>
      </div>

      <!-- Add tag input -->
      <div class="mb-5">
        <p class="text-xs text-muted-foreground mb-2">Ajouter un tag</p>
        <div class="flex gap-2">
          <input
            ref="inputRef"
            v-model="newTag"
            type="text"
            placeholder="Nom du tag…"
            class="flex-1 h-9 rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            @keydown.enter.prevent="addTag"
            @keydown.comma.prevent="addTag"
          />
          <button
            type="button"
            class="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border text-sm hover:bg-accent transition-colors"
            @click="addTag"
          >
            <Plus class="h-4 w-4" />
            Ajouter
          </button>
        </div>
      </div>

      <!-- Error message -->
      <p v-if="error" class="mb-3 text-xs text-destructive">{{ error }}</p>

      <!-- Footer -->
      <div class="flex justify-end gap-2">
        <button
          type="button"
          class="px-4 py-2 rounded-lg border border-border text-sm hover:bg-accent transition-colors"
          @click="emit('close')"
        >
          Annuler
        </button>
        <button
          type="button"
          :disabled="isSaving"
          class="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          @click="save"
        >
          {{ isSaving ? "Enregistrement…" : "Enregistrer" }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick, useTemplateRef } from "vue";
import { X, Plus } from "lucide-vue-next";

const props = defineProps<{
  slidePath: string;
  initialTags: string[];
}>();

const emit = defineEmits<{
  close: [];
  saved: [];
}>();

const currentTags = ref<string[]>([...props.initialTags]);
const newTag = ref("");
const isSaving = ref(false);
const error = ref("");
const inputRef = useTemplateRef<HTMLInputElement>("inputRef");

function addTag() {
  const tag = newTag.value.trim().replace(/,$/, "").trim();
  if (!tag) return;
  if (currentTags.value.includes(tag)) {
    newTag.value = "";
    return;
  }
  currentTags.value.push(tag);
  newTag.value = "";
  nextTick(() => inputRef.value?.focus());
}

function removeTag(tag: string) {
  currentTags.value = currentTags.value.filter((t) => t !== tag);
}

async function save() {
  if (isSaving.value) return;
  isSaving.value = true;
  error.value = "";

  try {
    const response = await fetch("/api/slides/tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: props.slidePath, tags: currentTags.value }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(body || `HTTP ${response.status}`);
    }

    emit("saved");
  } catch (err) {
    error.value = err instanceof Error ? err.message : "Erreur inconnue";
  } finally {
    isSaving.value = false;
  }
}
</script>
