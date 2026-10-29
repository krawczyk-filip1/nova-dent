<script setup lang="ts">
import { useId } from 'vue'

defineProps<{ error?: string }>()
const checked = defineModel<boolean | undefined>()
defineOptions({ inheritAttrs: false })

const id = useId()
const errorId = `${id}-error`
</script>

<template>
  <div class="flex flex-col gap-1.5">
    <div class="flex items-start gap-3">
      <input
        :id="id"
        v-model="checked"
        v-bind="$attrs"
        type="checkbox"
        :aria-invalid="error ? 'true' : undefined"
        :aria-describedby="error ? errorId : undefined"
        class="mt-0.5 size-5 shrink-0 accent-brand-600"
      />
      <label :for="id" class="text-sm leading-relaxed text-ink-muted"><slot /></label>
    </div>
    <p v-if="error" :id="errorId" class="text-sm font-semibold text-brand-800">{{ error }}</p>
  </div>
</template>
