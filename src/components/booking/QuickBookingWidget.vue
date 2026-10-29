<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { fetchEmployees } from '@/api/public'
import SelectField from '@/components/ui/SelectField.vue'
import { useAvailability } from '@/composables/useAvailability'
import {
  addDaysToKey,
  clinicToday,
  formatClinicTime,
  formatRelativeDay,
  toClinicDateKey,
} from '@/lib/dates'
import { useBookingFlowStore } from '@/stores/bookingFlow'
import type { Employee, Service, TimeSlot } from '@/types/models'
import { employeeLabel } from '@/utils/employees'
import { formatDuration } from '@/utils/money'

const props = defineProps<{ services: Service[] }>()

const SHOWN_SLOTS = 4
const router = useRouter()
const flow = useBookingFlowStore()
const today = clinicToday()

const serviceId = ref(props.services[0]?.id ?? '')
const employeeId = ref('any')
const employees = ref<Employee[]>([])

watch(
  serviceId,
  async (id) => {
    employeeId.value = 'any'
    employees.value = id ? await fetchEmployees(id).catch(() => []) : []
  },
  { immediate: true },
)

const serviceOptions = computed(() =>
  props.services.map((s) => ({
    value: s.id,
    label: `${s.name} · ${formatDuration(s.durationMin)}`,
  })),
)
const employeeOptions = computed(() => [
  { value: 'any', label: 'Dowolny dostępny' },
  ...employees.value.map((e) => ({ value: e.id, label: employeeLabel(e) })),
])

const { slots, status } = useAvailability(() =>
  serviceId.value
    ? {
        serviceId: serviceId.value,
        employeeId: employeeId.value,
        from: today,
        to: addDaysToKey(today, 13),
      }
    : null,
)
const nearest = computed(() =>
  slots.value.slice(0, SHOWN_SLOTS).map((slot) => ({
    slot,
    day: formatRelativeDay(toClinicDateKey(slot.start), today),
    time: formatClinicTime(slot.start),
  })),
)

function pick(slot: TimeSlot) {
  // Kolejność ma znaczenie: wybór usługi czyści lekarza i termin w kreatorze.
  flow.selectService(serviceId.value)
  flow.selectEmployee(employeeId.value)
  flow.selectSlot({
    start: slot.start,
    end: slot.end,
    employeeId: employeeId.value === 'any' ? slot.employeeIds[0]! : employeeId.value,
  })
  void router.push({ name: 'booking-details' })
}
</script>

<template>
  <section
    aria-labelledby="szybka-rezerwacja"
    class="flex flex-col gap-4 rounded-3xl bg-white p-6 shadow-[0_1px_2px_rgba(42,33,29,0.06)]"
  >
    <h2 id="szybka-rezerwacja" class="text-xl font-bold">Zarezerwuj wizytę</h2>
    <SelectField v-model="serviceId" label="Usługa" :options="serviceOptions" />
    <SelectField v-model="employeeId" label="Lekarz" :options="employeeOptions" />

    <div class="flex flex-col gap-2">
      <h3 class="text-sm font-semibold">Najbliższe terminy</h3>
      <div
        v-if="status !== 'ready' && status !== 'error'"
        aria-busy="true"
        aria-label="Ładowanie terminów"
        class="grid grid-cols-2 gap-2"
      >
        <div
          v-for="n in SHOWN_SLOTS"
          :key="n"
          class="h-14 rounded-2xl bg-sand-100 motion-safe:animate-pulse"
        />
      </div>
      <p v-else-if="status === 'error'" class="text-sm text-ink-muted">
        Nie udało się pobrać terminów – skorzystaj z pełnego kalendarza.
      </p>
      <p v-else-if="nearest.length === 0" class="text-sm text-ink-muted">
        Brak wolnych terminów w najbliższych dwóch tygodniach.
      </p>
      <ul v-else class="grid grid-cols-2 gap-2">
        <li v-for="item in nearest" :key="item.slot.start">
          <button
            type="button"
            class="flex min-h-14 w-full flex-col items-start rounded-2xl border-[1.5px] border-line px-3 py-2 text-left hover:border-brand-600"
            :aria-label="`${item.day}, ${item.time} – zarezerwuj`"
            @click="pick(item.slot)"
          >
            <span class="text-[13px] text-ink-muted">{{ item.day }}</span>
            <span class="text-lg font-bold tabular-nums">{{ item.time }}</span>
          </button>
        </li>
      </ul>
    </div>

    <RouterLink
      :to="{ name: 'booking-slot', query: { usluga: serviceId } }"
      class="rounded-full bg-brand-600 px-5 py-3.5 text-center font-bold text-white hover:bg-brand-700"
    >
      Więcej terminów
    </RouterLink>
  </section>
</template>
