<script setup lang="ts">
export interface Delta {
  text: string
  direction: 'up' | 'down' | 'flat'
  good: boolean
}

defineProps<{
  label: string
  value: string
  delta?: Delta | null
  comparedTo: string
  hint?: string
}>()
</script>

<template>
  <div class="flex flex-col gap-1 rounded-2xl bg-white p-5 ring-1 ring-line">
    <p class="text-sm font-semibold text-ink-muted">{{ label }}</p>
    <p class="text-3xl font-extrabold tracking-tight">{{ value }}</p>
    <p v-if="delta" class="text-sm">
      <span
        class="font-semibold"
        :class="
          delta.direction === 'flat'
            ? 'text-ink-muted'
            : delta.good
              ? 'text-ok-800'
              : 'text-brand-800'
        "
      >
        <template v-if="delta.direction === 'up'">▲ wzrost o {{ delta.text }}</template>
        <template v-else-if="delta.direction === 'down'">▼ spadek o {{ delta.text }}</template>
        <template v-else>bez zmian</template>
      </span>
      <span class="text-ink-muted">{{ ' ' + comparedTo }}</span>
    </p>
    <p v-else class="text-sm text-ink-muted">brak danych do porównania</p>
    <p v-if="hint" class="text-xs text-ink-soft">{{ hint }}</p>
  </div>
</template>
