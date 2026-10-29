<script setup lang="ts">
import { computed, useId } from 'vue'

const props = defineProps<{
  label: string
  error?: string
  hint?: string
  multiline?: boolean
}>()
const model = defineModel<string | undefined>()
defineOptions({ inheritAttrs: false })

const id = useId()
const hintId = `${id}-hint`
const errorId = `${id}-error`
const describedBy = computed(
  () => [props.hint && hintId, props.error && errorId].filter(Boolean).join(' ') || undefined,
)
const fieldClass = computed(() => [
  'w-full rounded-xl border-[1.5px] bg-white px-3.5 py-3 text-base text-ink placeholder:text-ink-soft',
  props.error ? 'border-brand-700' : 'border-line hover:border-ink-soft',
])
</script>

<template>
  <div class="flex flex-col gap-1.5">
    <label :for="id" class="text-sm font-semibold">{{ label }}</label>
    <textarea
      v-if="multiline"
      :id="id"
      v-model="model"
      v-bind="$attrs"
      rows="3"
      :aria-invalid="error ? 'true' : undefined"
      :aria-describedby="describedBy"
      :class="fieldClass"
    />
    <input
      v-else
      :id="id"
      v-model="model"
      v-bind="$attrs"
      :aria-invalid="error ? 'true' : undefined"
      :aria-describedby="describedBy"
      :class="fieldClass"
    />
    <p v-if="hint" :id="hintId" class="text-sm text-ink-soft">{{ hint }}</p>
    <p v-if="error" :id="errorId" class="text-sm font-semibold text-brand-800">{{ error }}</p>
  </div>
</template>
