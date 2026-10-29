<script setup lang="ts">
import type { BookingStatus } from '@/types/models'
import { STATUS_LABELS } from '@/utils/transitions'

defineProps<{ status: BookingStatus }>()

const classes: Record<BookingStatus, string> = {
  pending: 'bg-white text-ink-muted border border-line',
  confirmed: 'bg-ok-100 text-ok-800',
  completed: 'bg-sand-50 text-ink-muted border border-line',
  cancelled: 'bg-brand-100 text-brand-800',
}
</script>

<template>
  <span
    class="inline-block rounded-full px-3 py-1.5 text-sm font-semibold"
    :class="classes[status]"
  >
    {{ STATUS_LABELS[status] }}
  </span>
</template>
