<script setup lang="ts">
import { computed } from 'vue'
import { formatClinicDay, type DateKey } from '@/lib/dates'
import { onRadioGroupKeydown } from '@/lib/radioGroup'
import { countLabel } from '@/utils/plural'

export interface DayOption {
  date: DateKey
  count: number
}

const props = defineProps<{ days: DayOption[]; today: DateKey }>()
const selected = defineModel<DateKey | null>({ required: true })

const items = computed(() =>
  props.days.map((day) => {
    const free = countLabel(day.count, ['wolny termin', 'wolne terminy', 'wolnych terminów'])
    return {
      ...day,
      weekday: day.date === props.today ? 'dziś' : formatClinicDay(day.date, 'EEEEEE'),
      dayNumber: formatClinicDay(day.date, 'd'),
      month: formatClinicDay(day.date, 'MMM'),
      label: `${formatClinicDay(day.date, 'EEEE, d MMMM')}, ${day.count ? free : 'brak wolnych terminów'}`,
      disabled: day.count === 0,
      checked: day.date === selected.value,
    }
  }),
)

const focusableDate = computed(
  () => items.value.find((d) => d.checked)?.date ?? items.value.find((d) => !d.disabled)?.date,
)
</script>

<template>
  <div
    role="radiogroup"
    aria-label="Dzień wizyty"
    class="grid grid-cols-[repeat(auto-fill,minmax(4.25rem,1fr))] gap-2"
    @keydown="onRadioGroupKeydown"
  >
    <button
      v-for="day in items"
      :key="day.date"
      type="button"
      role="radio"
      :aria-checked="day.checked"
      :aria-disabled="day.disabled"
      :aria-label="day.label"
      :tabindex="day.date === focusableDate ? 0 : -1"
      class="flex min-h-[4.5rem] flex-col items-center justify-center gap-0.5 rounded-2xl border-[1.5px] px-1 py-2 transition-colors"
      :class="
        day.checked
          ? 'border-brand-600 bg-brand-600 text-white'
          : day.disabled
            ? 'cursor-not-allowed border-transparent bg-sand-50 text-ink-soft'
            : 'border-line bg-white hover:border-brand-600'
      "
      @click="!day.disabled && (selected = day.date)"
    >
      <span class="text-[13px]">{{ day.weekday }}</span>
      <span class="text-xl leading-none font-bold">{{ day.dayNumber }}</span>
      <span class="text-xs" :class="day.checked ? 'text-white' : 'text-ink-soft'">
        {{ day.disabled ? '–' : day.month }}
      </span>
    </button>
  </div>
</template>
