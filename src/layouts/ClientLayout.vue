<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'
import BrandLogo from '@/components/ui/BrandLogo.vue'
import SkipLink from '@/components/ui/SkipLink.vue'
import { CLINIC } from '@/constants/clinic'
</script>

<template>
  <SkipLink />
  <div class="flex min-h-dvh flex-col">
    <header
      class="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6"
    >
      <RouterLink :to="{ name: 'services' }" class="rounded-lg">
        <BrandLogo />
      </RouterLink>
      <nav aria-label="Główna" class="flex flex-wrap items-center gap-x-6 gap-y-2 font-medium">
        <RouterLink :to="{ name: 'services' }" class="hover:text-brand-700">Usługi</RouterLink>
        <RouterLink :to="{ name: 'my-booking' }" class="hover:text-brand-700">
          Moja rezerwacja
        </RouterLink>
        <a :href="CLINIC.phoneHref" class="hover:text-brand-700">{{ CLINIC.phoneDisplay }}</a>
      </nav>
    </header>

    <main
      id="tresc"
      tabindex="-1"
      class="mx-auto w-full max-w-6xl flex-1 px-4 pb-16 outline-none sm:px-6"
    >
      <RouterView />
    </main>

    <footer class="bg-ink text-sand-200">
      <div class="mx-auto flex max-w-6xl flex-wrap justify-between gap-3 px-4 py-8 text-sm sm:px-6">
        <span>{{ CLINIC.name }} · {{ CLINIC.address }}</span>
        <span>{{ CLINIC.openingHours }}</span>
      </div>
    </footer>
  </div>
</template>
