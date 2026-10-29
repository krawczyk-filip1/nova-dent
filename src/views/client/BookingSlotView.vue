<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { fetchEmployees } from '@/api/public'
import BookingSteps from '@/components/booking/BookingSteps.vue'
import DayPicker, { type DayOption } from '@/components/booking/DayPicker.vue'
import EmployeePicker from '@/components/booking/EmployeePicker.vue'
import TimeSlotPicker from '@/components/booking/TimeSlotPicker.vue'
import { useAvailability } from '@/composables/useAvailability'
import {
  addDaysToKey,
  clinicToday,
  daysBetween,
  formatClinicDay,
  formatClinicTime,
  toClinicDateKey,
  type DateKey,
} from '@/lib/dates'
import { useBookingFlowStore } from '@/stores/bookingFlow'
import { useServicesStore } from '@/stores/services'
import type { Employee, TimeSlot } from '@/types/models'
import { employeeLabel } from '@/utils/employees'
import { formatDuration, formatServicePrice } from '@/utils/money'
import { countLabel } from '@/utils/plural'

const DAYS_PER_PAGE = 14
/** 4 x 14 = 56 dni naprzód - mieści się w limicie zapytania o dostępność (62 dni). */
const MAX_PAGES = 4

const router = useRouter()
const flow = useBookingFlowStore()
const servicesStore = useServicesStore()
const today = clinicToday()

const service = computed(() => (flow.serviceId ? servicesStore.getById(flow.serviceId) : undefined))
const serviceMissing = computed(() => servicesStore.status === 'ready' && !service.value)

const employees = ref<Employee[]>([])
const employeeId = computed({
  get: () => flow.employeeId,
  set: (id: string) => flow.selectEmployee(id),
})

onMounted(async () => {
  void servicesStore.load()
  if (flow.serviceId) {
    employees.value = await fetchEmployees(flow.serviceId).catch(() => [])
  }
})

function pageOf(date: DateKey): number {
  const page = Math.floor(daysBetween(today, date) / DAYS_PER_PAGE)
  return Math.min(Math.max(page, 0), MAX_PAGES - 1)
}

const page = ref(flow.slot ? pageOf(toClinicDateKey(flow.slot.start)) : 0)
const from = computed(() => addDaysToKey(today, page.value * DAYS_PER_PAGE))
const to = computed(() => addDaysToKey(from.value, DAYS_PER_PAGE - 1))
const rangeLabel = computed(
  () => `${formatClinicDay(from.value, 'd MMM')} – ${formatClinicDay(to.value, 'd MMM')}`,
)

const { slots, status, error, reload } = useAvailability(() =>
  flow.serviceId && !serviceMissing.value
    ? { serviceId: flow.serviceId, employeeId: flow.employeeId, from: from.value, to: to.value }
    : null,
)

const slotsByDay = computed(() => {
  const map = new Map<DateKey, TimeSlot[]>()
  for (const slot of slots.value) {
    const day = toClinicDateKey(slot.start)
    map.set(day, [...(map.get(day) ?? []), slot])
  }
  return map
})

const days = computed<DayOption[]>(() =>
  Array.from({ length: DAYS_PER_PAGE }, (_, i) => {
    const date = addDaysToKey(from.value, i)
    return { date, count: slotsByDay.value.get(date)?.length ?? 0 }
  }),
)
const pageHasSlots = computed(() => days.value.some((d) => d.count > 0))

const selectedDay = ref<DateKey | null>(flow.slot ? toClinicDateKey(flow.slot.start) : null)
const daySlots = computed(() =>
  selectedDay.value ? (slotsByDay.value.get(selectedDay.value) ?? []) : [],
)
const daySlotsLabel = computed(() =>
  selectedDay.value ? `Godzina, ${formatClinicDay(selectedDay.value, 'EEEE, d MMMM')}` : 'Godzina',
)

const selectedStart = ref<string | null>(flow.slot?.start ?? null)
watch(
  () => flow.slot,
  (slot) => (selectedStart.value = slot?.start ?? null),
)

const lostSlot = ref(false)

watch(status, (current) => {
  if (current !== 'ready') return

  const saved = flow.slot
  if (saved) {
    const day = toClinicDateKey(saved.start)
    const match = slots.value.find((s) => s.start === saved.start)
    if (day >= from.value && day <= to.value) {
      if (!match) {
        flow.selectSlot(null)
        lostSlot.value = true
      } else if (!match.employeeIds.includes(saved.employeeId)) {
        // "Dowolny dostępny": ten sam termin u innego wolnego lekarza.
        flow.selectSlot({ ...saved, employeeId: match.employeeIds[0]! })
      }
    }
  }

  const stillValid = days.value.some((d) => d.date === selectedDay.value && d.count > 0)
  if (!stillValid) selectedDay.value = days.value.find((d) => d.count > 0)?.date ?? null
})

function pickSlot(slot: TimeSlot) {
  lostSlot.value = false
  flow.selectSlot({
    start: slot.start,
    end: slot.end,
    employeeId: flow.employeeId === 'any' ? slot.employeeIds[0]! : flow.employeeId,
  })
}

const chosenLabel = computed(() => {
  const slot = flow.slot
  if (!slot) return null
  const day = formatClinicDay(toClinicDateKey(slot.start), 'EEEE, d MMMM')
  const employee = employees.value.find((e) => e.id === slot.employeeId)
  const who = employee ? ` · ${employeeLabel(employee)}` : ''
  return `${day}, ${formatClinicTime(slot.start)}${who}`
})

function goNext() {
  void router.push({ name: 'booking-details' })
}
</script>

<template>
  <div class="flex flex-col gap-6 pt-2">
    <BookingSteps :current="1" />

    <section
      v-if="serviceMissing"
      role="alert"
      class="flex flex-col items-start gap-4 rounded-3xl bg-sand-100 p-6"
    >
      <h1 class="text-2xl font-extrabold">Ta usługa nie jest już dostępna online</h1>
      <p class="text-ink-muted">Wybierz inną usługę albo zadzwoń do gabinetu.</p>
      <RouterLink
        :to="{ name: 'services' }"
        class="rounded-full bg-brand-600 px-6 py-3 font-bold text-white hover:bg-brand-700"
      >
        Wróć do listy usług
      </RouterLink>
    </section>

    <template v-else>
      <header class="flex flex-wrap items-end justify-between gap-4">
        <div class="flex flex-col gap-1">
          <h1 class="text-3xl font-extrabold tracking-tight sm:text-4xl">Wybierz termin</h1>
          <p v-if="service" class="text-ink-muted">
            <strong class="font-bold text-ink">{{ service.name }}</strong>
            · {{ formatDuration(service.durationMin) }} · {{ formatServicePrice(service) }}
          </p>
        </div>
        <RouterLink :to="{ name: 'services' }" class="font-semibold text-brand-700 underline">
          Zmień usługę
        </RouterLink>
      </header>

      <section aria-labelledby="lekarz-naglowek" class="flex flex-col gap-3">
        <h2 id="lekarz-naglowek" class="text-lg font-bold">Lekarz</h2>
        <EmployeePicker v-model="employeeId" :employees="employees" />
      </section>

      <section
        aria-labelledby="dzien-naglowek"
        class="flex flex-col gap-4 rounded-3xl bg-sand-50 p-4 sm:p-6"
      >
        <div class="flex flex-wrap items-center justify-between gap-3">
          <h2 id="dzien-naglowek" class="text-lg font-bold">
            Dzień <span class="font-medium text-ink-soft">· {{ rangeLabel }}</span>
          </h2>
          <div class="flex gap-2">
            <button
              type="button"
              class="min-h-11 rounded-full border-[1.5px] border-line bg-white px-4 font-semibold enabled:hover:border-brand-600 disabled:opacity-50"
              :disabled="page === 0"
              @click="page--"
            >
              <span aria-hidden="true">←</span> Wcześniej
            </button>
            <button
              type="button"
              class="min-h-11 rounded-full border-[1.5px] border-line bg-white px-4 font-semibold enabled:hover:border-brand-600 disabled:opacity-50"
              :disabled="page === MAX_PAGES - 1"
              @click="page++"
            >
              Później <span aria-hidden="true">→</span>
            </button>
          </div>
        </div>

        <div v-if="status === 'error'" role="alert" class="flex flex-col items-start gap-3">
          <p class="text-ink-muted">Nie udało się pobrać wolnych terminów. {{ error }}</p>
          <button
            type="button"
            class="rounded-full border-[1.5px] border-brand-600 px-5 py-2.5 font-bold text-brand-700 hover:bg-brand-100"
            @click="reload"
          >
            Spróbuj ponownie
          </button>
        </div>

        <div
          v-else-if="status !== 'ready'"
          aria-busy="true"
          aria-label="Ładowanie wolnych terminów"
          class="grid grid-cols-[repeat(auto-fill,minmax(4.25rem,1fr))] gap-2"
        >
          <div
            v-for="n in DAYS_PER_PAGE"
            :key="n"
            class="h-[4.5rem] motion-safe:animate-pulse rounded-2xl bg-sand-100"
          />
        </div>

        <template v-else>
          <DayPicker v-model="selectedDay" :days="days" :today="today" />

          <div v-if="!pageHasSlots" class="flex flex-col items-start gap-3 py-2">
            <p class="text-ink-muted">
              W tych dniach nie ma wolnych terminów{{
                flow.employeeId === 'any' ? '' : ' u wybranej osoby'
              }}.
            </p>
            <button
              v-if="page < MAX_PAGES - 1"
              type="button"
              class="rounded-full border-[1.5px] border-brand-600 px-5 py-2.5 font-bold text-brand-700 hover:bg-brand-100"
              @click="page++"
            >
              Pokaż kolejne dni
            </button>
          </div>

          <div v-else-if="selectedDay" class="flex flex-col gap-3 pt-2">
            <h3 class="font-semibold text-ink-muted">
              {{ formatClinicDay(selectedDay, 'EEEE, d MMMM') }} ·
              {{
                countLabel(daySlots.length, ['wolna godzina', 'wolne godziny', 'wolnych godzin'])
              }}
            </h3>
            <TimeSlotPicker
              v-model="selectedStart"
              :slots="daySlots"
              :label="daySlotsLabel"
              @pick="pickSlot"
            />
          </div>
        </template>
      </section>

      <p v-if="lostSlot" role="status" class="rounded-2xl bg-brand-100 p-4 text-brand-800">
        Wybrany wcześniej termin został w międzyczasie zajęty. Wybierz inną godzinę.
      </p>

      <div
        class="sticky bottom-0 -mx-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-3 border-t border-line bg-white/95 px-4 py-4 backdrop-blur sm:static sm:mx-0 sm:bg-transparent sm:px-0 sm:pt-5 sm:pb-0 sm:backdrop-blur-none"
      >
        <p aria-live="polite" class="text-ink-muted">
          <template v-if="chosenLabel">
            Wybrano: <strong class="font-bold text-ink">{{ chosenLabel }}</strong>
          </template>
          <template v-else>Wybierz dzień i godzinę wizyty.</template>
        </p>
        <button
          type="button"
          class="min-h-12 rounded-full bg-brand-600 px-7 font-bold text-white enabled:hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
          :disabled="!flow.hasSlot"
          @click="goNext"
        >
          Dalej: Twoje dane
        </button>
      </div>
    </template>
  </div>
</template>
