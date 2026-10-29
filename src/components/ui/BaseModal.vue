<script setup lang="ts">
import { nextTick, onBeforeUnmount, useId, useTemplateRef, watch } from 'vue'

const props = defineProps<{ open: boolean; title: string }>()
const emit = defineEmits<{ close: [] }>()

const dialog = useTemplateRef<HTMLDialogElement>('dialog')
const titleId = useId()
let opener: HTMLElement | null = null

watch(
  () => props.open,
  async (open) => {
    await nextTick()
    const el = dialog.value
    if (!el) return
    if (open && !el.open) {
      opener = document.activeElement as HTMLElement | null
      el.showModal()
    } else if (!open && el.open) {
      el.close()
    }
  },
  { immediate: true },
)

// Zdarzenie "close" przychodzi też po Escape - informujemy rodzica, żeby zsynchronizował `open`.
function onClose() {
  opener?.focus()
  opener = null
  if (props.open) emit('close')
}

function onClick(event: MouseEvent) {
  if (event.target === dialog.value) emit('close')
}

onBeforeUnmount(() => {
  if (dialog.value?.open) dialog.value.close()
})
</script>

<template>
  <dialog
    ref="dialog"
    :aria-labelledby="titleId"
    class="m-auto w-[min(36rem,calc(100vw-2rem))] rounded-3xl bg-white p-0 text-ink shadow-xl backdrop:bg-ink/50"
    @close="onClose"
    @click="onClick"
  >
    <div class="flex max-h-[85dvh] flex-col">
      <header class="flex items-start justify-between gap-4 border-b border-line px-6 py-4">
        <h2 :id="titleId" class="text-xl font-bold">{{ title }}</h2>
        <button
          type="button"
          aria-label="Zamknij"
          class="-mr-2 flex size-11 shrink-0 items-center justify-center rounded-full text-ink-muted hover:bg-sand-100"
          @click="emit('close')"
        >
          <svg
            viewBox="0 0 24 24"
            class="size-5"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            aria-hidden="true"
          >
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </header>
      <div class="overflow-y-auto px-6 py-5">
        <slot />
      </div>
      <footer v-if="$slots.footer" class="border-t border-line px-6 py-4">
        <slot name="footer" />
      </footer>
    </div>
  </dialog>
</template>
