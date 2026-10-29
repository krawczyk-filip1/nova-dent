<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import ToothIcon from '@/components/ui/ToothIcon.vue'
import type { Service } from '@/types/models'
import { formatDuration, formatServicePrice } from '@/utils/money'

const props = defineProps<{ service: Service }>()

const price = computed(() => formatServicePrice(props.service))
const duration = computed(() => formatDuration(props.service.durationMin))
</script>

<template>
  <RouterLink
    :to="{ name: 'booking-slot', query: { usluga: service.id } }"
    class="flex items-center gap-4 rounded-[22px] bg-sand-50 px-5 py-5 transition-colors hover:bg-sand-100"
  >
    <span
      class="flex size-12 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-700"
    >
      <ToothIcon class="size-[22px]" />
    </span>
    <span class="flex min-w-0 flex-1 flex-col gap-0.5">
      <span class="text-[17px] font-bold">{{ service.name }}</span>
      <span class="text-sm text-ink-soft">{{ duration }} · {{ service.description }}</span>
    </span>
    <span class="shrink-0 font-bold text-brand-700">{{ price }}</span>
  </RouterLink>
</template>
