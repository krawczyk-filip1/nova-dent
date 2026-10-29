<script setup lang="ts">
import { CLINIC } from '@/constants/clinic'
import ToothIcon from './ToothIcon.vue'
</script>

<template>
  <span class="flex items-center gap-2.5">
    <span class="flex size-9 items-center justify-center rounded-full bg-brand-600 text-white">
      <ToothIcon class="size-5" />
    </span>
    <span class="flex flex-col leading-tight">
      <span class="text-xl font-extrabold">{{ CLINIC.name }}</span>
      <span class="text-[13px] font-medium text-ink-soft">{{ CLINIC.tagline }}</span>
    </span>
  </span>
</template>
