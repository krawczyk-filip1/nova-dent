<script setup lang="ts">
import { RouterLink } from 'vue-router'
import ToothIcon from '@/components/ui/ToothIcon.vue'

defineProps<{
  lines: { service: string; details: string; date: string; time: string; employee: string }
  editable?: boolean
}>()
</script>

<template>
  <section
    aria-label="Twoja wizyta"
    class="flex flex-wrap items-start gap-4 rounded-3xl bg-sand-100 p-5 sm:p-6"
  >
    <span
      class="flex size-12 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-700"
    >
      <ToothIcon class="size-6" />
    </span>
    <div class="flex min-w-0 flex-1 flex-col gap-1">
      <p class="text-lg font-bold">{{ lines.service }}</p>
      <p class="text-ink-muted">{{ lines.date }}, {{ lines.time }}</p>
      <p class="text-ink-muted">{{ lines.employee }} · {{ lines.details }}</p>
    </div>
    <RouterLink
      v-if="editable"
      :to="{ name: 'booking-slot' }"
      class="font-semibold text-brand-700 underline"
    >
      Zmień termin
    </RouterLink>
  </section>
</template>
