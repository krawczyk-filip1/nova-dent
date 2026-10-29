<script setup lang="ts">
import { useId } from 'vue'

defineProps<{ title: string; subtitle?: string }>()
const titleId = useId()
</script>

<template>
  <figure
    :aria-labelledby="titleId"
    class="m-0 flex flex-col gap-4 rounded-2xl bg-white p-5 ring-1 ring-line"
  >
    <figcaption class="flex flex-col gap-0.5">
      <h2 :id="titleId" class="text-lg font-bold">{{ title }}</h2>
      <p v-if="subtitle" class="text-sm text-ink-muted">{{ subtitle }}</p>
    </figcaption>
    <slot />
    <details v-if="$slots.table" class="text-sm">
      <summary class="cursor-pointer font-semibold text-brand-700">Pokaż jako tabelę</summary>
      <div class="mt-3 max-h-72 overflow-auto">
        <slot name="table" />
      </div>
    </details>
  </figure>
</template>
