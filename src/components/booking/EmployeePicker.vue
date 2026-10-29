<script setup lang="ts">
import { computed } from 'vue'
import { onRadioGroupKeydown } from '@/lib/radioGroup'
import type { Employee } from '@/types/models'
import { employeeLabel } from '@/utils/employees'

const props = defineProps<{ employees: Employee[] }>()
const selected = defineModel<string>({ required: true })

const options = computed(() => [
  { id: 'any', label: 'Dowolny dostępny' },
  ...props.employees.map((e) => ({ id: e.id, label: employeeLabel(e) })),
])
</script>

<template>
  <div
    role="radiogroup"
    aria-label="Lekarz"
    class="flex flex-wrap gap-2"
    @keydown="onRadioGroupKeydown"
  >
    <button
      v-for="option in options"
      :key="option.id"
      type="button"
      role="radio"
      :aria-checked="selected === option.id"
      :tabindex="selected === option.id ? 0 : -1"
      class="min-h-11 rounded-full border-[1.5px] px-4 py-2 font-semibold transition-colors"
      :class="
        selected === option.id
          ? 'border-brand-600 bg-brand-600 text-white'
          : 'border-line bg-white hover:border-brand-600'
      "
      @click="selected = option.id"
    >
      {{ option.label }}
    </button>
  </div>
</template>
