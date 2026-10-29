<script setup lang="ts">
import { computed } from 'vue'
import { onRovingKeydown } from '@/lib/rovingFocus'

export interface Column {
  key: string
  axisLabel: string
  description: string
  value: number
}

const props = defineProps<{
  columns: Column[]
  label: string
  height?: number
}>()

const plotHeight = computed(() => props.height ?? 180)

const axisMax = computed(() => {
  const max = Math.max(1, ...props.columns.map((c) => c.value))
  const magnitude = 10 ** Math.floor(Math.log10(max))
  const step = [1, 2, 5, 10].find((m) => m * magnitude >= max)!
  return step * magnitude
})
const ticks = computed(() => [axisMax.value, axisMax.value / 2, 0])

function tooltipPosition(index: number) {
  const position = index / Math.max(1, props.columns.length - 1)
  if (position < 0.2) return 'left-0'
  if (position > 0.8) return 'right-0'
  return 'left-1/2 -translate-x-1/2'
}

const labelEvery = computed(() => Math.ceil(props.columns.length / 7))
</script>

<template>
  <div class="flex gap-2">
    <div
      class="relative w-7 shrink-0 text-right text-xs text-ink-soft tabular-nums"
      :style="{ height: `${plotHeight}px` }"
      aria-hidden="true"
    >
      <span
        v-for="(tick, i) in ticks"
        :key="tick"
        class="absolute right-0 -translate-y-1/2"
        :style="{ top: `${(i / (ticks.length - 1)) * 100}%` }"
      >
        {{ tick }}
      </span>
    </div>

    <div class="min-w-0 flex-1">
      <div
        role="group"
        :aria-label="label"
        class="relative flex items-end gap-0.5 border-b border-line"
        :style="{ height: `${plotHeight}px` }"
        @keydown="onRovingKeydown($event, '[data-bar]')"
      >
        <div
          class="pointer-events-none absolute inset-x-0 top-0 border-t border-sand-100"
          aria-hidden="true"
        />
        <div
          class="pointer-events-none absolute inset-x-0 top-1/2 border-t border-sand-100"
          aria-hidden="true"
        />

        <div
          v-for="(column, index) in columns"
          :key="column.key"
          data-bar
          :tabindex="index === 0 ? 0 : -1"
          :aria-label="column.description"
          role="img"
          class="group relative flex h-full flex-1 cursor-default items-end justify-center outline-none"
        >
          <div
            class="w-full max-w-6 rounded-t-[4px] bg-brand-600 transition-colors group-hover:bg-brand-800 group-focus-visible:bg-brand-800"
            :style="{
              height: column.value > 0 ? `max(2px, ${(column.value / axisMax) * 100}%)` : '0',
            }"
          />
          <span
            class="pointer-events-none absolute bottom-full z-10 mb-1 hidden rounded-lg bg-ink px-2.5 py-1.5 text-xs whitespace-nowrap text-white group-hover:block group-focus-visible:block"
            :class="tooltipPosition(index)"
            aria-hidden="true"
          >
            {{ column.description }}
          </span>
        </div>
      </div>

      <div class="flex gap-0.5 pt-1.5 text-xs text-ink-soft tabular-nums" aria-hidden="true">
        <span
          v-for="(column, index) in columns"
          :key="column.key"
          class="min-w-0 flex-1 overflow-visible text-center whitespace-nowrap"
        >
          {{ index % labelEvery === 0 ? column.axisLabel : '' }}
        </span>
      </div>
    </div>
  </div>
</template>
