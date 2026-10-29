<script setup lang="ts">
import { computed } from 'vue'
import { formatClinicTime } from '@/lib/dates'
import { onRadioGroupKeydown } from '@/lib/radioGroup'
import type { TimeSlot } from '@/types/models'

const props = defineProps<{ slots: TimeSlot[]; label: string }>()
const selected = defineModel<string | null>({ required: true })
const emit = defineEmits<{ pick: [slot: TimeSlot] }>()

const items = computed(() =>
  props.slots.map((slot) => ({
    slot,
    time: formatClinicTime(slot.start),
    checked: slot.start === selected.value,
  })),
)
const focusableStart = computed(
  () => items.value.find((i) => i.checked)?.slot.start ?? items.value[0]?.slot.start,
)

function pick(slot: TimeSlot) {
  selected.value = slot.start
  emit('pick', slot)
}
</script>

<template>
  <div
    role="radiogroup"
    :aria-label="label"
    class="grid grid-cols-[repeat(auto-fill,minmax(5.5rem,1fr))] gap-2"
    @keydown="onRadioGroupKeydown"
  >
    <button
      v-for="item in items"
      :key="item.slot.start"
      type="button"
      role="radio"
      :aria-checked="item.checked"
      :tabindex="item.slot.start === focusableStart ? 0 : -1"
      class="min-h-12 rounded-xl border-[1.5px] text-base font-semibold tabular-nums transition-colors"
      :class="
        item.checked
          ? 'border-brand-600 bg-brand-600 text-white'
          : 'border-line bg-white hover:border-brand-600'
      "
      @click="pick(item.slot)"
    >
      {{ item.time }}
    </button>
  </div>
</template>
