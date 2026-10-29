<script setup lang="ts">
export interface Meter {
  key: string
  label: string
  ratio: number | null
  valueLabel: string
  detail?: string
}

defineProps<{ meters: Meter[] }>()
</script>

<template>
  <ul class="flex flex-col gap-4">
    <li v-for="meter in meters" :key="meter.key" class="flex flex-col gap-1.5">
      <div class="flex flex-wrap items-baseline justify-between gap-x-3">
        <span class="font-semibold">{{ meter.label }}</span>
        <span class="text-sm text-ink-muted">{{ meter.valueLabel }}</span>
      </div>
      <div
        role="meter"
        :aria-label="meter.label"
        aria-valuemin="0"
        aria-valuemax="100"
        :aria-valuenow="meter.ratio === null ? undefined : Math.round(meter.ratio * 100)"
        :aria-valuetext="meter.valueLabel"
        class="h-2.5 overflow-hidden rounded-full bg-brand-100"
      >
        <div
          class="h-full rounded-full bg-brand-600"
          :style="{ width: `${Math.min(1, meter.ratio ?? 0) * 100}%` }"
        />
      </div>
      <p v-if="meter.detail" class="text-xs text-ink-soft">{{ meter.detail }}</p>
    </li>
  </ul>
</template>
