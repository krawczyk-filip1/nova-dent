<script setup lang="ts">
import { computed } from 'vue'
import type { BookingStatus } from '@/types/models'
import { assignLanes } from '@/utils/lanes'

export interface GridItem {
  id: string
  startMin: number
  endMin: number
  time: string
  title: string
  subtitle: string
  status: BookingStatus
  label: string
}

export interface GridColumn {
  key: string
  title: string
  subtitle?: string
  working: { startMin: number; endMin: number }[]
  items: GridItem[]
  today?: boolean
}

const props = defineProps<{
  columns: GridColumn[]
  axisStartMin: number
  axisEndMin: number
  nowMin: number | null
}>()
const emit = defineEmits<{ open: [id: string] }>()

const PX_PER_MIN = 1.2
const px = (minutes: number) => `${minutes * PX_PER_MIN}px`
const height = computed(() => px(props.axisEndMin - props.axisStartMin))

const hours = computed(() => {
  const list: { label: string; top: string }[] = []
  for (let m = Math.ceil(props.axisStartMin / 60) * 60; m <= props.axisEndMin; m += 60) {
    list.push({ label: `${String(m / 60).padStart(2, '0')}:00`, top: px(m - props.axisStartMin) })
  }
  return list
})

const gridLines = computed(() => ({
  backgroundImage: `repeating-linear-gradient(to bottom, var(--color-line) 0 1px, transparent 1px ${px(60)})`,
  backgroundPosition: `0 ${px((60 - (props.axisStartMin % 60)) % 60)}`,
}))

const laidOut = computed(() =>
  props.columns.map((column) => ({
    ...column,
    items: assignLanes(column.items.map((i) => ({ ...i, start: i.startMin, end: i.endMin }))),
  })),
)

const statusClasses: Record<BookingStatus, string> = {
  pending: 'border-2 border-dashed border-brand-600 bg-white text-ink',
  confirmed: 'border border-ok-800/30 bg-ok-100 text-ok-800',
  completed: 'border border-line bg-sand-100 text-ink-muted',
  cancelled: 'border border-line bg-white text-ink-soft line-through opacity-75',
}

const showNow = (column: GridColumn) =>
  column.today &&
  props.nowMin !== null &&
  props.nowMin >= props.axisStartMin &&
  props.nowMin <= props.axisEndMin
</script>

<template>
  <div class="overflow-x-auto rounded-2xl border border-line bg-white">
    <div
      class="grid min-w-max pb-3"
      :style="{ gridTemplateColumns: `3.5rem repeat(${columns.length}, minmax(10rem, 1fr))` }"
    >
      <div class="border-b border-line" />
      <div
        v-for="column in columns"
        :key="`h-${column.key}`"
        class="border-b border-l border-line px-3 py-2"
        :class="column.today ? 'bg-brand-100' : ''"
      >
        <p class="font-bold">{{ column.title }}</p>
        <p v-if="column.subtitle" class="text-sm text-ink-muted">{{ column.subtitle }}</p>
      </div>

      <div class="relative" :style="{ height }" aria-hidden="true">
        <span
          v-for="hour in hours"
          :key="hour.label"
          class="absolute right-2 -translate-y-1/2 text-xs text-ink-soft tabular-nums"
          :style="{ top: hour.top }"
        >
          {{ hour.label }}
        </span>
      </div>

      <section
        v-for="column in laidOut"
        :key="column.key"
        :aria-label="[column.title, column.subtitle].filter(Boolean).join(', ')"
        class="relative border-l border-line bg-sand-100"
        :style="{ height }"
      >
        <div
          v-for="(range, index) in column.working"
          :key="index"
          class="absolute inset-x-0 bg-white"
          :style="{
            top: px(range.startMin - axisStartMin),
            height: px(range.endMin - range.startMin),
          }"
          aria-hidden="true"
        />
        <div class="pointer-events-none absolute inset-0" :style="gridLines" aria-hidden="true" />

        <div
          v-if="showNow(column)"
          class="absolute inset-x-0 z-20 h-0.5 bg-brand-600"
          :style="{ top: px(nowMin! - axisStartMin) }"
        >
          <span class="sr-only">Teraz</span>
        </div>

        <button
          v-for="item in column.items"
          :key="item.id"
          type="button"
          :aria-label="item.label"
          class="absolute z-10 overflow-hidden rounded-lg px-1.5 py-0.5 text-left text-xs leading-tight hover:z-30 hover:shadow-md focus-visible:z-30"
          :class="statusClasses[item.status]"
          :style="{
            top: px(item.startMin - axisStartMin),
            height: `calc(${px(item.endMin - item.startMin)} - 2px)`,
            left: `calc(${(item.lane / item.lanes) * 100}% + 2px)`,
            width: `calc(${100 / item.lanes}% - 4px)`,
          }"
          @click="emit('open', item.id)"
        >
          <span class="font-semibold tabular-nums">{{ item.time }}</span>
          {{ item.title }}
          <span class="block truncate">{{ item.subtitle }}</span>
        </button>

        <p
          v-if="column.working.length === 0 && column.items.length === 0"
          class="absolute inset-x-0 top-4 text-center text-sm text-ink-muted"
        >
          Nie pracuje
        </p>
      </section>
    </div>
  </div>
</template>
