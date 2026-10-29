<script setup lang="ts">
import BaseModal from './BaseModal.vue'

defineProps<{
  open: boolean
  title: string
  confirmLabel: string
  busy?: boolean
  error?: string | null
}>()
const emit = defineEmits<{ confirm: []; cancel: [] }>()
</script>

<template>
  <BaseModal :open="open" :title="title" @close="emit('cancel')">
    <div class="flex flex-col gap-4">
      <slot />
      <p
        v-if="error"
        role="alert"
        class="rounded-2xl bg-brand-100 p-3 font-semibold text-brand-800"
      >
        {{ error }}
      </p>
    </div>
    <template #footer>
      <div class="flex flex-wrap gap-3">
        <button
          type="button"
          :disabled="busy"
          class="min-h-11 rounded-full bg-brand-600 px-5 font-bold text-white hover:bg-brand-700 disabled:cursor-wait disabled:opacity-60"
          @click="emit('confirm')"
        >
          {{ confirmLabel }}
        </button>
        <button
          type="button"
          :disabled="busy"
          class="min-h-11 rounded-full border-[1.5px] border-line px-5 font-semibold hover:border-ink-soft"
          @click="emit('cancel')"
        >
          Anuluj
        </button>
      </div>
    </template>
  </BaseModal>
</template>
