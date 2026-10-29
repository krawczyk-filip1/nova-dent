<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { fetchStats } from '@/api/admin'
import BarList from '@/components/stats/BarList.vue'
import ChartCard from '@/components/stats/ChartCard.vue'
import ColumnChart, { type Column } from '@/components/stats/ColumnChart.vue'
import MeterList from '@/components/stats/MeterList.vue'
import StatTile, { type Delta } from '@/components/stats/StatTile.vue'
import {
  addDaysToKey,
  clinicToday,
  daysBetween,
  formatClinicDay,
  isDateKey,
  type DateKey,
} from '@/lib/dates'
import type { LoadStatus } from '@/stores/services'
import type { StatsResponse } from '@/types/api'
import { formatPrice } from '@/utils/money'
import { countLabel } from '@/utils/plural'
import { percentChange } from '@/utils/stats'

const route = useRoute()
const router = useRouter()
const today = clinicToday()

function monthStart(date: DateKey): DateKey {
  return `${date.slice(0, 8)}01`
}
function monthEnd(date: DateKey): DateKey {
  return addDaysToKey(monthStart(addDaysToKey(monthStart(date), 31)), -1)
}

const PRESETS = [
  {
    id: '7d',
    label: 'Ostatnie 7 dni',
    range: () => ({ from: addDaysToKey(today, -6), to: today }),
  },
  {
    id: '30d',
    label: 'Ostatnie 30 dni',
    range: () => ({ from: addDaysToKey(today, -29), to: today }),
  },
  {
    id: '90d',
    label: 'Ostatnie 90 dni',
    range: () => ({ from: addDaysToKey(today, -89), to: today }),
  },
  {
    id: 'ten-miesiac',
    label: 'Ten miesiąc',
    range: () => ({ from: monthStart(today), to: monthEnd(today) }),
  },
  {
    id: 'poprzedni-miesiac',
    label: 'Poprzedni miesiąc',
    range: () => {
      const lastOfPrevious = addDaysToKey(monthStart(today), -1)
      return { from: monthStart(lastOfPrevious), to: lastOfPrevious }
    },
  },
] as const

const custom = computed(() => {
  const { od, do: to } = route.query
  return typeof od === 'string' &&
    typeof to === 'string' &&
    isDateKey(od) &&
    isDateKey(to) &&
    od <= to
    ? { from: od, to }
    : null
})
const presetId = computed(() =>
  custom.value ? null : (PRESETS.find((p) => p.id === route.query.zakres)?.id ?? '30d'),
)
const range = computed(() => custom.value ?? PRESETS.find((p) => p.id === presetId.value)!.range())
const days = computed(() => daysBetween(range.value.from, range.value.to) + 1)

const comparedTo = computed(
  () => `vs poprzednie ${countLabel(days.value, ['dzień', 'dni', 'dni'])}`,
)
const rangeLabel = computed(
  () =>
    `${formatClinicDay(range.value.from, 'd MMMM yyyy')} – ${formatClinicDay(range.value.to, 'd MMMM yyyy')}`,
)

const customFrom = ref(range.value.from)
const customTo = ref(range.value.to)
function applyCustom() {
  if (
    isDateKey(customFrom.value) &&
    isDateKey(customTo.value) &&
    customFrom.value <= customTo.value
  ) {
    void router.replace({ query: { od: customFrom.value, do: customTo.value } })
  }
}

const data = ref<StatsResponse | null>(null)
const status = ref<LoadStatus>('idle')
const error = ref<string | null>(null)
let requestId = 0

watch(
  range,
  async (r) => {
    const id = ++requestId
    status.value = 'loading'
    error.value = null
    customFrom.value = r.from
    customTo.value = r.to
    try {
      const result = await fetchStats(r)
      if (id !== requestId) return
      data.value = result
      status.value = 'ready'
    } catch (e) {
      if (id !== requestId) return
      error.value = e instanceof Error ? e.message : 'Nieznany błąd.'
      status.value = 'error'
    }
  },
  { immediate: true, deep: true },
)

const percent = new Intl.NumberFormat('pl-PL', { style: 'percent', maximumFractionDigits: 0 })
const formatPercent = (v: number | null) => (v === null ? '–' : percent.format(v))

function relativeDelta(current: number, previous: number, upIsGood = true): Delta | null {
  const change = percentChange(current, previous)
  if (change === null) return null
  const rounded = Math.round(change * 100)
  if (rounded === 0) return { text: '0%', direction: 'flat', good: true }
  return {
    text: `${Math.abs(rounded)}%`,
    direction: rounded > 0 ? 'up' : 'down',
    good: rounded > 0 === upIsGood,
  }
}

function pointsDelta(
  current: number | null,
  previous: number | null,
  upIsGood: boolean,
): Delta | null {
  if (current === null || previous === null) return null
  const diff = Math.round((current - previous) * 100)
  if (diff === 0) return { text: '0 p.p.', direction: 'flat', good: true }
  return {
    text: `${Math.abs(diff)} p.p.`,
    direction: diff > 0 ? 'up' : 'down',
    good: diff > 0 === upIsGood,
  }
}

const tiles = computed(() => {
  if (!data.value) return []
  const { current: c, previous: p } = data.value
  return [
    {
      label: 'Wizyty',
      value: String(c.visits),
      delta: relativeDelta(c.visits, p.visits),
      hint: `w tym zakończone: ${c.completed}`,
    },
    {
      label: 'Przychód',
      value: formatPrice(c.revenueGrosze),
      delta: relativeDelta(c.revenueGrosze, p.revenueGrosze),
      hint: 'z zakończonych wizyt, wg cennika',
    },
    {
      label: 'Obłożenie grafiku',
      value: formatPercent(c.utilization),
      delta: pointsDelta(c.utilization, p.utilization, true),
      hint: 'zajęty czas / godziny pracy',
    },
    {
      label: 'Odwołania',
      value: formatPercent(c.cancellationRate),
      delta: pointsDelta(c.cancellationRate, p.cancellationRate, false),
      hint: `${countLabel(c.cancelled, ['wizyta', 'wizyty', 'wizyt'])} odwołanych`,
    },
  ]
})

const visitsLabel = (n: number) => countLabel(n, ['wizyta', 'wizyty', 'wizyt'])

const dailyColumns = computed<Column[]>(() =>
  (data.value?.current.perDay ?? []).map((d) => ({
    key: d.date,
    axisLabel: formatClinicDay(d.date, days.value > 31 ? 'd.MM' : 'd'),
    description: `${formatClinicDay(d.date, 'EEEE, d MMMM')}: ${visitsLabel(d.visits)}`,
    value: d.visits,
  })),
)

const weekdayColumns = computed<Column[]>(() =>
  (data.value?.current.perWeekday ?? []).map((d) => ({
    key: String(d.weekday),
    axisLabel: d.label.slice(0, 3).toLowerCase(),
    description: `${d.label}: ${visitsLabel(d.visits)}`,
    value: d.visits,
  })),
)

const serviceBars = computed(() =>
  (data.value?.current.perService ?? []).map((s) => ({
    key: s.serviceId,
    label: s.name,
    value: s.visits,
    valueLabel: String(s.visits),
  })),
)

const meters = computed(() =>
  (data.value?.current.perEmployee ?? []).map((e) => ({
    key: e.employeeId,
    label: e.name,
    ratio: e.utilization,
    valueLabel: `${formatPercent(e.utilization)} · ${visitsLabel(e.visits)}`,
    detail:
      e.availableMin > 0
        ? `${Math.round(e.bookedMin / 60)} h z ${Math.round(e.availableMin / 60)} h w grafiku`
        : 'brak godzin pracy w tym okresie',
  })),
)
</script>

<template>
  <div class="flex flex-col gap-5">
    <header class="flex flex-col gap-1">
      <h1 class="text-3xl font-extrabold tracking-tight">Statystyki</h1>
      <p class="text-ink-muted">{{ rangeLabel }}</p>
    </header>

    <div class="flex flex-wrap items-end gap-3">
      <nav
        aria-label="Zakres dat"
        class="flex flex-wrap gap-1 rounded-2xl bg-white p-1 ring-1 ring-line"
      >
        <RouterLink
          v-for="preset in PRESETS"
          :key="preset.id"
          :to="{ query: { zakres: preset.id } }"
          replace
          :aria-current="presetId === preset.id ? 'page' : undefined"
          class="min-h-10 rounded-xl px-3 py-2 text-sm font-semibold"
          :class="presetId === preset.id ? 'bg-brand-600 text-white' : 'hover:bg-sand-100'"
        >
          {{ preset.label }}
        </RouterLink>
      </nav>
      <form class="flex flex-wrap items-end gap-2" @submit.prevent="applyCustom">
        <label class="flex flex-col gap-1 text-sm font-semibold">
          Od
          <input
            v-model="customFrom"
            type="date"
            class="min-h-10 rounded-xl border-[1.5px] border-line bg-white px-2 font-normal"
          />
        </label>
        <label class="flex flex-col gap-1 text-sm font-semibold">
          Do
          <input
            v-model="customTo"
            type="date"
            :min="customFrom"
            class="min-h-10 rounded-xl border-[1.5px] border-line bg-white px-2 font-normal"
          />
        </label>
        <button
          type="submit"
          class="min-h-10 rounded-xl px-3 text-sm font-semibold ring-1 ring-line hover:bg-sand-100"
          :class="custom ? 'bg-brand-600 text-white ring-brand-600 hover:bg-brand-700' : 'bg-white'"
        >
          Pokaż
        </button>
      </form>
    </div>

    <p v-if="status === 'error'" role="alert" class="text-brand-800">
      Nie udało się policzyć statystyk. {{ error }}
    </p>
    <div
      v-else-if="!data"
      aria-busy="true"
      class="h-96 motion-safe:animate-pulse rounded-2xl bg-sand-100"
    />

    <div
      v-else
      class="flex flex-col gap-5 transition-opacity"
      :class="status === 'loading' ? 'opacity-60' : ''"
      :aria-busy="status === 'loading'"
    >
      <section aria-label="Najważniejsze liczby" class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          v-for="tile in tiles"
          :key="tile.label"
          :label="tile.label"
          :value="tile.value"
          :delta="tile.delta"
          :compared-to="comparedTo"
          :hint="tile.hint"
        />
      </section>

      <ChartCard
        title="Wizyty dzień po dniu"
        subtitle="Bez odwołanych. Strzałki przechodzą między dniami."
      >
        <ColumnChart :columns="dailyColumns" label="Liczba wizyt w kolejnych dniach" />
        <template #table>
          <table class="w-full text-left">
            <thead>
              <tr>
                <th scope="col" class="py-1 pr-4">Dzień</th>
                <th scope="col" class="py-1">Wizyty</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="d in data.current.perDay" :key="d.date" class="border-t border-line">
                <td class="py-1 pr-4">{{ formatClinicDay(d.date, 'EEEEEE, d.MM') }}</td>
                <td class="py-1 tabular-nums">{{ d.visits }}</td>
              </tr>
            </tbody>
          </table>
        </template>
      </ChartCard>

      <div class="grid gap-5 lg:grid-cols-2">
        <ChartCard
          title="Obłożenie grafiku"
          subtitle="Jaka część godzin pracy jest zajęta wizytami"
        >
          <MeterList :meters="meters" />
        </ChartCard>

        <ChartCard title="Wizyty według dnia tygodnia">
          <ColumnChart
            :columns="weekdayColumns"
            label="Liczba wizyt w poszczególne dni tygodnia"
            :height="150"
          />
          <template #table>
            <table class="w-full text-left">
              <tbody>
                <tr
                  v-for="d in data.current.perWeekday"
                  :key="d.weekday"
                  class="border-t border-line"
                >
                  <th scope="row" class="py-1 pr-4 font-normal">{{ d.label }}</th>
                  <td class="py-1 tabular-nums">{{ d.visits }}</td>
                </tr>
              </tbody>
            </table>
          </template>
        </ChartCard>
      </div>

      <ChartCard title="Najczęstsze usługi" subtitle="Liczba wizyt w wybranym okresie">
        <BarList v-if="serviceBars.length" :items="serviceBars" />
        <p v-else class="text-ink-muted">Brak wizyt w tym okresie.</p>
      </ChartCard>
    </div>
  </div>
</template>
