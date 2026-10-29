<script setup lang="ts">
import { computed } from 'vue'

export interface BarItem {
  key: string
  label: string
  value: number
  valueLabel: string
}

const props = defineProps<{ items: BarItem[] }>()
const max = computed(() => Math.max(1, ...props.items.map((i) => i.value)))
</script>

<template>
  <ul class="flex flex-col gap-3">
    <li
      v-for="item in items"
      :key="item.key"
      class="grid grid-cols-[minmax(0,11rem)_1fr] items-center gap-3"
    >
      <span class="truncate text-sm" :title="item.label">{{ item.label }}</span>
      <span class="flex items-center gap-2">
        <span
          class="h-3 rounded-r-[4px] bg-brand-600"
          :style="{ width: `${(item.value / max) * 85}%`, minWidth: item.value > 0 ? '2px' : '0' }"
          aria-hidden="true"
        />
        <span class="shrink-0 text-sm font-semibold tabular-nums">{{ item.valueLabel }}</span>
      </span>
    </li>
  </ul>
</template>
