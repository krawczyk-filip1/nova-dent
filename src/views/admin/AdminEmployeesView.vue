<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { fetchAdminEmployees, fetchAdminServices } from '@/api/admin'
import WeekScheduleEditor from '@/components/admin/WeekScheduleEditor.vue'
import { useCatalogChanged } from '@/composables/useCatalogChanged'
import type { LoadStatus } from '@/stores/services'
import type { Employee, Service } from '@/types/models'

const employees = ref<Employee[]>([])
const services = ref<Service[]>([])
const status = ref<LoadStatus>('idle')
const loadError = ref<string | null>(null)
const catalogChanged = useCatalogChanged()

onMounted(async () => {
  status.value = 'loading'
  try {
    ;[employees.value, services.value] = await Promise.all([
      fetchAdminEmployees(),
      fetchAdminServices(),
    ])
    status.value = 'ready'
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : 'Nieznany błąd.'
    status.value = 'error'
  }
})

const servicesOf = (employee: Employee) =>
  services.value.filter((s) => employee.serviceIds.includes(s.id))

function onSaved(updated: Employee) {
  employees.value = employees.value.map((e) => (e.id === updated.id ? updated : e))
  catalogChanged()
}
</script>

<template>
  <div class="flex flex-col gap-5">
    <header class="flex flex-col gap-1">
      <h1 class="text-3xl font-extrabold tracking-tight">Pracownicy</h1>
      <p class="text-ink-muted">
        Stałe godziny pracy. Urlopy i jednorazowe przerwy dodasz w
        <RouterLink :to="{ name: 'admin-blocks' }" class="font-semibold text-brand-700 underline">
          Blokadach</RouterLink
        >, a to, kto wykonuje którą usługę – w
        <RouterLink :to="{ name: 'admin-services' }" class="font-semibold text-brand-700 underline">
          Usługach</RouterLink
        >.
      </p>
    </header>

    <p v-if="status === 'error'" role="alert" class="text-brand-800">
      Nie udało się pobrać pracowników. {{ loadError }}
    </p>
    <div
      v-else-if="status !== 'ready'"
      aria-busy="true"
      class="h-64 motion-safe:animate-pulse rounded-2xl bg-sand-100"
    />

    <div v-else class="grid gap-5 xl:grid-cols-2">
      <section
        v-for="employee in employees"
        :key="employee.id"
        :aria-labelledby="`prac-${employee.id}`"
        class="flex flex-col gap-4 rounded-2xl bg-white p-5 ring-1 ring-line"
      >
        <div class="flex flex-col gap-1">
          <h2 :id="`prac-${employee.id}`" class="text-xl font-bold">{{ employee.name }}</h2>
          <p class="text-ink-muted">{{ employee.title }}</p>
          <ul class="flex flex-wrap gap-1.5 pt-1" aria-label="Wykonywane usługi">
            <li
              v-for="service in servicesOf(employee)"
              :key="service.id"
              class="rounded-full bg-sand-100 px-2.5 py-1 text-sm"
            >
              {{ service.name }}
            </li>
          </ul>
        </div>
        <WeekScheduleEditor :employee="employee" :services="services" @saved="onSaved" />
      </section>
    </div>
  </div>
</template>
