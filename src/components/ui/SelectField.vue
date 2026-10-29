<script setup lang="ts">
import { computed, useId } from 'vue'

const props = defineProps<{
  label: string
  options: { value: string | number; label: string }[]
  error?: string
  hint?: string
}>()
const model = defineModel<string | number | undefined>()
defineOptions({ inheritAttrs: false })

const id = useId()
const hintId = `${id}-hint`
const errorId = `${id}-error`
const describedBy = computed(
  () => [props.hint && hintId, props.error && errorId].filter(Boolean).join(' ') || undefined,
)
</script>

<template>
  <div class="flex flex-col gap-1.5">
    <label :for="id" class="text-sm font-semibold">{{ label }}</label>
    <select
      :id="id"
      v-model="model"
      v-bind="$attrs"
      :aria-invalid="error ? 'true' : undefined"
      :aria-describedby="describedBy"
      class="min-h-12 w-full rounded-xl border-[1.5px] bg-white px-3 text-base text-ink"
      :class="error ? 'border-brand-700' : 'border-line hover:border-ink-soft'"
    >
      <option v-for="option in options" :key="option.value" :value="option.value">
        {{ option.label }}
      </option>
    </select>
    <p v-if="hint" :id="hintId" class="text-sm text-ink-soft">{{ hint }}</p>
    <p v-if="error" :id="errorId" class="text-sm font-semibold text-brand-800">{{ error }}</p>
  </div>
</template>
