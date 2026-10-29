<script setup lang="ts">
import { computed, onMounted, ref, useTemplateRef } from 'vue'
import { RouterLink } from 'vue-router'
import { fetchEmployees } from '@/api/public'
import { formatClinicDay, formatClinicTime, toClinicDateKey } from '@/lib/dates'
import { useBookingFlowStore } from '@/stores/bookingFlow'
import { useServicesStore } from '@/stores/services'
import type { Employee } from '@/types/models'
import { employeeLabel } from '@/utils/employees'

const props = defineProps<{ code: string }>()

const flow = useBookingFlowStore()
const servicesStore = useServicesStore()
const employees = ref<Employee[]>([])
const heading = useTemplateRef<HTMLElement>('heading')

// Szczegóły znamy tylko w karcie, w której rezerwacja powstała. Kto wejdzie z linku - zobaczy sam kod.
const booking = computed(() => (flow.lastBooking?.code === props.code ? flow.lastBooking : null))

onMounted(async () => {
  heading.value?.focus()
  void servicesStore.load()
  if (booking.value) {
    employees.value = await fetchEmployees(booking.value.serviceId).catch(() => [])
  }
})

const details = computed(() => {
  const b = booking.value
  if (!b) return null
  const employee = employees.value.find((e) => e.id === b.employeeId)
  return {
    service: servicesStore.getById(b.serviceId)?.name ?? '…',
    when: `${formatClinicDay(toClinicDateKey(b.start), 'EEEE, d MMMM yyyy')}, ${formatClinicTime(b.start)}`,
    employee: employee ? employeeLabel(employee) : '…',
    email: b.customer.email,
  }
})
</script>

<template>
  <section class="flex max-w-2xl flex-col gap-6 py-6">
    <div class="flex flex-col gap-3">
      <span
        class="self-start rounded-full bg-sand-100 px-3 py-1.5 text-sm font-semibold text-ink-muted"
      >
        Czeka na potwierdzenie gabinetu
      </span>
      <h1 ref="heading" tabindex="-1" class="text-3xl font-extrabold tracking-tight sm:text-4xl">
        Rezerwacja przyjęta
      </h1>
    </div>

    <div class="flex flex-col gap-2 rounded-3xl bg-sand-100 p-6">
      <p class="text-ink-muted">Kod rezerwacji</p>
      <p class="font-mono text-4xl font-bold tracking-wider text-brand-700 select-all">
        {{ code }}
      </p>
      <p v-if="details" class="text-ink-muted">
        Kod razem z adresem <strong class="text-ink">{{ details.email }}</strong> pozwala sprawdzić
        lub odwołać wizytę.
      </p>
      <p v-else class="text-ink-muted">
        Szczegóły wizyty sprawdzisz w zakładce „Moja rezerwacja”, podając ten kod i swój e-mail.
      </p>
    </div>

    <dl v-if="details" class="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2">
      <dt class="font-semibold">Usługa</dt>
      <dd class="text-ink-muted">{{ details.service }}</dd>
      <dt class="font-semibold">Termin</dt>
      <dd class="text-ink-muted">{{ details.when }}</dd>
      <dt class="font-semibold">Lekarz</dt>
      <dd class="text-ink-muted">{{ details.employee }}</dd>
    </dl>

    <p class="text-ink-muted">
      Gdy gabinet potwierdzi wizytę, dostaniesz SMS. Odwołać ją możesz online najpóźniej 24 godziny
      przed terminem.
    </p>

    <div class="flex flex-wrap gap-3">
      <RouterLink
        :to="{ name: 'my-booking', query: { kod: code } }"
        class="rounded-full bg-brand-600 px-6 py-3 font-bold text-white hover:bg-brand-700"
      >
        Moja rezerwacja
      </RouterLink>
      <RouterLink
        :to="{ name: 'services' }"
        class="rounded-full border-[1.5px] border-brand-600 px-6 py-3 font-bold text-brand-700 hover:bg-brand-100"
      >
        Umów kolejną wizytę
      </RouterLink>
    </div>
  </section>
</template>
