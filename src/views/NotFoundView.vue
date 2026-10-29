<script setup lang="ts">
import { RouterLink } from 'vue-router'
</script>

<template>
  <section class="flex flex-col items-start gap-4 py-16">
    <h1 class="text-3xl font-extrabold tracking-tight">Nie ma takiej strony</h1>
    <p class="text-ink-muted">Adres mógł się zmienić albo zawiera literówkę.</p>
    <RouterLink
      :to="{ name: 'services' }"
      class="rounded-full bg-brand-600 px-6 py-3 font-bold text-white hover:bg-brand-700"
    >
      Wróć do listy usług
    </RouterLink>
  </section>
</template>
