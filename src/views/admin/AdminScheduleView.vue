<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import BookingDetailsModal from '@/components/admin/BookingDetailsModal.vue'
import ScheduleGrid, { type GridColumn, type GridItem } from '@/components/admin/ScheduleGrid.vue'
import {
  addDaysToKey,
  clinicMinutesOfDay,
  clinicToday,
  clinicWeekday,
  formatClinicDay,
  formatClinicTime,
  isDateKey,
  startOfClinicWeek,
  timeToMinutes,
  toClinicDateKey,
  type DateKey,
} from '@/lib/dates'
import { useScheduleStore } from '@/stores/schedule'
import type { Booking, BookingStatus, Employee } from '@/types/models'
import { employeeLabel } from '@/utils/employees'
import { countLabel, plural } from '@/utils/plural'
import { STATUS_LABELS } from '@/utils/transitions'

type ViewMode = 'dzien' | 'tydzien'

const route = useRoute()
const router = useRouter()
const store = useScheduleStore()

const today = clinicToday()
const mode = computed<ViewMode>(() => (route.query.widok === 'tydzien' ? 'tydzien' : 'dzien'))
const date = computed<DateKey>(() => {
  const value = route.query.data
  return typeof value === 'string' && isDateKey(value) ? value : today
})

const range = computed(() => {
  if (mode.value === 'dzien') return { from: date.value, to: date.value }
  const monday = startOfClinicWeek(date.value)
  return { from: monday, to: addDaysToKey(monday, 6) }
})
const days = computed(() =>
  Array.from({ length: mode.value === 'dzien' ? 1 : 7 }, (_, i) =>
    addDaysToKey(range.value.from, i),
  ),
)

function goTo(query: { widok?: ViewMode; data?: DateKey }) {
  void router.replace({ query: { ...route.query, ...query } })
}
function shift(direction: -1 | 1) {
  goTo({ data: addDaysToKey(date.value, direction * (mode.value === 'dzien' ? 1 : 7)) })
}
function onDateInput(event: Event) {
  const value = (event.target as HTMLInputElement).value
  if (isDateKey(value)) goTo({ data: value })
}

const heading = computed(() => {
  if (mode.value === 'dzien') return formatClinicDay(date.value, 'EEEE, d MMMM yyyy')
  const { from, to } = range.value
  const sameMonth = from.slice(0, 7) === to.slice(0, 7)
  return `${formatClinicDay(from, sameMonth ? 'd' : 'd MMMM')} – ${formatClinicDay(to, 'd MMMM yyyy')}`
})

watch(range, (r) => store.load(r), { immediate: true, deep: true })

const employeeFilter = ref('all')
const showCancelled = ref(false)

const visibleBookings = computed(() =>
  store.bookings.filter(
    (b) =>
      (showCancelled.value || b.status !== 'cancelled') &&
      (mode.value === 'dzien' ||
        employeeFilter.value === 'all' ||
        b.employeeId === employeeFilter.value),
  ),
)

const now = ref(new Date())
let timer: ReturnType<typeof setInterval> | undefined
onMounted(() => (timer = setInterval(() => (now.value = new Date()), 60_000)))
onBeforeUnmount(() => clearInterval(timer))
const nowMin = computed(() => clinicMinutesOfDay(now.value))

const serviceName = (id: string) => store.services.find((s) => s.id === id)?.name ?? 'Usługa'
const employeeById = (id: string) => store.employees.find((e) => e.id === id)

function workingRange(employee: Employee, day: DateKey) {
  const hours = employee.schedule[clinicWeekday(day)]
  return hours ? [{ startMin: timeToMinutes(hours.start), endMin: timeToMinutes(hours.end) }] : []
}

function toItem(booking: Booking, withEmployee: boolean): GridItem {
  const service = serviceName(booking.serviceId)
  const time = `${formatClinicTime(booking.start)}–${formatClinicTime(booking.end)}`
  const employee = employeeById(booking.employeeId)
  const who = withEmployee && employee ? ` · ${employee.name.split(' ').at(-1)}` : ''
  return {
    id: booking.id,
    startMin: clinicMinutesOfDay(booking.start),
    endMin: clinicMinutesOfDay(booking.end),
    time: formatClinicTime(booking.start),
    title: service,
    subtitle: booking.customer.name + who,
    status: booking.status,
    label: `${time}, ${service}, ${booking.customer.name}${employee ? `, ${employeeLabel(employee)}` : ''}, ${STATUS_LABELS[booking.status]}`,
  }
}

const columns = computed<GridColumn[]>(() => {
  if (mode.value === 'dzien') {
    const day = date.value
    // Pokazujemy osoby, które tego dnia pracują albo mają wizyty (np. dopisane poza grafikiem).
    return store.employees
      .filter(
        (e) =>
          workingRange(e, day).length > 0 ||
          visibleBookings.value.some((b) => b.employeeId === e.id),
      )
      .map((employee) => ({
        key: employee.id,
        title: employee.name,
        subtitle: employee.title,
        working: workingRange(employee, day),
        items: visibleBookings.value
          .filter((b) => b.employeeId === employee.id)
          .map((b) => toItem(b, false)),
        today: day === today,
      }))
  }

  const people =
    employeeFilter.value === 'all'
      ? store.employees
      : store.employees.filter((e) => e.id === employeeFilter.value)
  return days.value.map((day) => ({
    key: day,
    title: formatClinicDay(day, 'EEEE'),
    subtitle: formatClinicDay(day, 'd MMMM'),
    working: people.flatMap((e) => workingRange(e, day)),
    items: visibleBookings.value
      .filter((b) => toClinicDateKey(b.start) === day)
      .map((b) => toItem(b, employeeFilter.value === 'all')),
    today: day === today,
  }))
})

const axis = computed(() => {
  const mins = columns.value.flatMap((c) => [
    ...c.working.flatMap((r) => [r.startMin, r.endMin]),
    ...c.items.flatMap((i) => [i.startMin, i.endMin]),
  ])
  if (mins.length === 0) return { start: 8 * 60, end: 18 * 60 }
  return {
    start: Math.floor(Math.min(...mins) / 60) * 60,
    end: Math.ceil(Math.max(...mins) / 60) * 60,
  }
})

const summary = computed(() => {
  const active = store.bookings.filter((b) => b.status !== 'cancelled')
  const pending = active.filter((b) => b.status === 'pending').length
  return `${countLabel(active.length, ['wizyta', 'wizyty', 'wizyt'])}, w tym ${pending} ${plural(pending, ['czeka', 'czekają', 'czeka'])} na potwierdzenie`
})

const selectedId = ref<string | null>(null)
const selected = computed(() => store.bookings.find((b) => b.id === selectedId.value) ?? null)
const busy = ref(false)
const actionError = ref<string | null>(null)
const announcement = ref('')

function open(id: string) {
  selectedId.value = id
  actionError.value = null
}

async function changeStatus(status: BookingStatus) {
  if (!selected.value) return
  busy.value = true
  actionError.value = null
  try {
    const updated = await store.changeStatus(selected.value.id, status)
    announcement.value = `${updated.customer.name}: ${STATUS_LABELS[updated.status].toLowerCase()}.`
    selectedId.value = null
  } catch (e) {
    actionError.value = e instanceof Error ? e.message : 'Nie udało się zmienić statusu.'
  } finally {
    busy.value = false
  }
}

const legend: { status: BookingStatus; swatch: string }[] = [
  { status: 'pending', swatch: 'border-2 border-dashed border-brand-600 bg-white' },
  { status: 'confirmed', swatch: 'border border-ok-800/30 bg-ok-100' },
  { status: 'completed', swatch: 'border border-line bg-sand-100' },
  { status: 'cancelled', swatch: 'border border-line bg-white' },
]
</script>

<template>
  <div class="flex flex-col gap-5">
    <header class="flex flex-wrap items-end justify-between gap-4">
      <div class="flex flex-col gap-1">
        <h1 class="text-3xl font-extrabold tracking-tight">Grafik</h1>
        <p class="text-ink-muted first-letter:uppercase">{{ heading }}</p>
      </div>
      <nav aria-label="Widok grafiku" class="flex rounded-full bg-white p-1 ring-1 ring-line">
        <RouterLink
          v-for="option in [
            { value: 'dzien', label: 'Dzień' },
            { value: 'tydzien', label: 'Tydzień' },
          ] as const"
          :key="option.value"
          :to="{ query: { ...route.query, widok: option.value } }"
          replace
          :aria-current="mode === option.value ? 'page' : undefined"
          class="min-h-10 rounded-full px-4 py-2 font-semibold"
          :class="mode === option.value ? 'bg-brand-600 text-white' : 'hover:bg-sand-100'"
        >
          {{ option.label }}
        </RouterLink>
      </nav>
    </header>

    <div class="flex flex-wrap items-center gap-3">
      <div class="flex gap-2">
        <button
          type="button"
          :aria-label="mode === 'dzien' ? 'Poprzedni dzień' : 'Poprzedni tydzień'"
          class="flex size-11 items-center justify-center rounded-full bg-white ring-1 ring-line hover:ring-ink-soft"
          @click="shift(-1)"
        >
          <span aria-hidden="true">←</span>
        </button>
        <button
          type="button"
          class="min-h-11 rounded-full bg-white px-4 font-semibold ring-1 ring-line hover:ring-ink-soft disabled:opacity-50"
          :disabled="days.includes(today)"
          @click="goTo({ data: today })"
        >
          Dziś
        </button>
        <button
          type="button"
          :aria-label="mode === 'dzien' ? 'Następny dzień' : 'Następny tydzień'"
          class="flex size-11 items-center justify-center rounded-full bg-white ring-1 ring-line hover:ring-ink-soft"
          @click="shift(1)"
        >
          <span aria-hidden="true">→</span>
        </button>
      </div>
      <label class="flex items-center gap-2 text-sm font-semibold">
        Data
        <input
          type="date"
          :value="date"
          class="min-h-11 rounded-xl border-[1.5px] border-line bg-white px-3 font-normal"
          @change="onDateInput"
        />
      </label>
      <label v-if="mode === 'tydzien'" class="flex items-center gap-2 text-sm font-semibold">
        Osoba
        <select
          v-model="employeeFilter"
          class="min-h-11 rounded-xl border-[1.5px] border-line bg-white px-3 font-normal"
        >
          <option value="all">Wszyscy</option>
          <option v-for="employee in store.employees" :key="employee.id" :value="employee.id">
            {{ employeeLabel(employee) }}
          </option>
        </select>
      </label>
      <label class="flex min-h-11 items-center gap-2 text-sm">
        <input v-model="showCancelled" type="checkbox" class="size-5 accent-brand-600" />
        Pokaż odwołane
      </label>
    </div>

    <div class="flex flex-wrap items-center justify-between gap-3 text-sm">
      <p v-if="store.status === 'ready'" class="font-semibold">{{ summary }}</p>
      <ul aria-label="Legenda" class="flex flex-wrap gap-x-4 gap-y-1 text-ink-muted">
        <li v-for="item in legend" :key="item.status" class="flex items-center gap-1.5">
          <span class="inline-block size-3.5 rounded" :class="item.swatch" aria-hidden="true" />
          {{ STATUS_LABELS[item.status] }}
        </li>
      </ul>
    </div>

    <p role="status" class="sr-only">{{ announcement }}</p>

    <div v-if="store.status === 'error'" role="alert" class="flex flex-col items-start gap-3">
      <p class="text-ink-muted">Nie udało się pobrać grafiku. {{ store.error }}</p>
      <button
        type="button"
        class="rounded-full border-[1.5px] border-brand-600 px-5 py-2.5 font-bold text-brand-700"
        @click="store.load(range)"
      >
        Spróbuj ponownie
      </button>
    </div>
    <div
      v-else-if="store.status !== 'ready'"
      aria-busy="true"
      aria-label="Ładowanie grafiku"
      class="h-96 motion-safe:animate-pulse rounded-2xl bg-sand-100"
    />
    <p
      v-else-if="columns.length === 0"
      class="rounded-2xl bg-white p-6 text-ink-muted ring-1 ring-line"
    >
      Tego dnia gabinet nie pracuje i nie ma żadnych wizyt.
    </p>
    <ScheduleGrid
      v-else
      :columns="columns"
      :axis-start-min="axis.start"
      :axis-end-min="axis.end"
      :now-min="nowMin"
      @open="open"
    />

    <BookingDetailsModal
      :booking="selected"
      :employees="store.employees"
      :services="store.services"
      :now="now"
      :busy="busy"
      :error="actionError"
      @close="selectedId = null"
      @change-status="changeStatus"
    />
  </div>
</template>
