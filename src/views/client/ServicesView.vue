<script setup lang="ts">
import { onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import QuickBookingWidget from '@/components/booking/QuickBookingWidget.vue'
import ServiceCard from '@/components/booking/ServiceCard.vue'
import { useServicesStore } from '@/stores/services'
import heroPhoto from '@/assets/images/gabinet.jpg'

const store = useServicesStore()
const { services, status, error } = storeToRefs(store)

onMounted(() => store.load())
</script>

<template>
  <section class="flex flex-wrap items-stretch gap-6 rounded-[32px] bg-sand-100 p-4 sm:p-6">
    <div class="flex min-w-0 flex-[2_1_480px] flex-col gap-5 p-2 sm:p-4">
      <h1 class="max-w-xl text-4xl font-extrabold tracking-tight sm:text-5xl">
        Zdrowy uśmiech bez kolejek do telefonu
      </h1>
      <p class="max-w-lg text-lg leading-relaxed text-ink-muted">
        Sprawdź wolne godziny i zarezerwuj wizytę od razu. Gabinet potwierdzi ją SMS-em.
      </p>
      <img
        :src="heroPhoto"
        alt="Gabinet z pomarańczowym fotelem dentystycznym"
        class="mt-auto hidden h-72 w-full rounded-3xl object-cover sm:block"
      />
    </div>
    <div class="min-w-0 flex-[1_1_320px]">
      <QuickBookingWidget v-if="status === 'ready' && services.length" :services="services" />
      <div
        v-else-if="status !== 'error'"
        aria-hidden="true"
        class="h-full min-h-96 rounded-3xl bg-white/60 motion-safe:animate-pulse"
      />
    </div>
  </section>

  <section id="uslugi" aria-labelledby="uslugi-naglowek" class="flex flex-col gap-6 pt-14">
    <h2 id="uslugi-naglowek" class="text-3xl font-extrabold tracking-tight">W czym pomożemy</h2>

    <div v-if="status === 'error'" role="alert" class="flex flex-col items-start gap-3">
      <p class="text-ink-muted">Nie udało się pobrać listy usług. {{ error }}</p>
      <button
        type="button"
        class="rounded-full border-[1.5px] border-brand-600 px-5 py-2.5 font-bold text-brand-700 hover:bg-brand-100"
        @click="store.load({ force: true })"
      >
        Spróbuj ponownie
      </button>
    </div>

    <ul
      v-else-if="status !== 'ready'"
      aria-busy="true"
      aria-label="Ładowanie usług"
      class="grid gap-4 sm:grid-cols-2"
    >
      <li
        v-for="n in 6"
        :key="n"
        class="h-[88px] motion-safe:animate-pulse rounded-[22px] bg-sand-50"
      />
    </ul>

    <p v-else-if="services.length === 0" class="text-ink-muted">
      Gabinet nie udostępnia teraz rezerwacji online. Zadzwoń, a umówimy wizytę telefonicznie.
    </p>

    <ul v-else class="grid gap-4 sm:grid-cols-2">
      <li v-for="service in services" :key="service.id">
        <ServiceCard :service="service" />
      </li>
    </ul>
  </section>
</template>
