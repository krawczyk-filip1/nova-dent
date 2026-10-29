<script setup lang="ts">
import { computed, ref } from 'vue'
import { updateEmployeeSchedule } from '@/api/admin'
import { ApiError } from '@/api/client'
import type { ValidationErrorBody } from '@/types/api'
import type { Booking, Employee, Service, Weekday } from '@/types/models'
import { TIME_OPTIONS, validateWeekSchedule, WEEKDAYS, type WeekSchedule } from '@/utils/schedule'
import ConflictList from './ConflictList.vue'

const props = defineProps<{ employee: Employee; services: Service[] }>()
const emit = defineEmits<{ saved: [employee: Employee] }>()

interface Row {
  day: Weekday
  label: string
  works: boolean
  start: string
  end: string
}

function toRows(schedule: WeekSchedule): Row[] {
  return WEEKDAYS.map(({ day, label }) => ({
    day,
    label,
    works: schedule[day] !== null,
    start: schedule[day]?.start ?? '08:00',
    end: schedule[day]?.end ?? '16:00',
  }))
}
const rows = ref<Row[]>(toRows(props.employee.schedule))
const saved = ref<WeekSchedule>(props.employee.schedule)

function toSchedule(list: Row[]): WeekSchedule {
  return Object.fromEntries(
    list.map((r) => [r.day, r.works ? { start: r.start, end: r.end } : null]),
  ) as WeekSchedule
}

const draft = computed(() => toSchedule(rows.value))
const dirty = computed(() => JSON.stringify(draft.value) !== JSON.stringify(saved.value))
const errors = computed(() => validateWeekSchedule(draft.value))
const hasErrors = computed(() => Object.keys(errors.value).length > 0)

const saving = ref(false)
const saveError = ref<string | null>(null)
const savedMessage = ref<string | null>(null)
const conflicts = ref<Booking[]>([])

async function save() {
  if (hasErrors.value || !dirty.value) return
  saving.value = true
  saveError.value = null
  savedMessage.value = null
  try {
    const result = await updateEmployeeSchedule(props.employee.id, draft.value)
    saved.value = result.employee.schedule
    conflicts.value = result.conflicts
    if (result.conflicts.length === 0) savedMessage.value = 'Zapisano godziny pracy.'
    emit('saved', result.employee)
  } catch (e) {
    const body = e instanceof ApiError ? (e.body as ValidationErrorBody | null) : null
    saveError.value = [
      e instanceof Error ? e.message : 'Nie udało się zapisać.',
      ...Object.values(body?.fieldErrors ?? {}),
    ].join(' ')
  } finally {
    saving.value = false
  }
}

function reset() {
  rows.value = toRows(saved.value)
  saveError.value = null
}

const idFor = (day: Weekday, part: string) => `${props.employee.id}-${day}-${part}`
</script>

<template>
  <form class="flex flex-col gap-4" @submit.prevent="save">
    <table class="w-full border-collapse text-left">
      <caption class="sr-only">
        Godziny pracy:
        {{
          employee.name
        }}
      </caption>
      <thead class="text-sm text-ink-muted">
        <tr>
          <th scope="col" class="py-2 pr-3 font-semibold">Dzień</th>
          <th scope="col" class="py-2 pr-3 font-semibold">Pracuje</th>
          <th scope="col" class="py-2 pr-3 font-semibold">Od</th>
          <th scope="col" class="py-2 font-semibold">Do</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in rows" :key="row.day" class="border-t border-line">
          <th scope="row" class="py-2 pr-3 font-medium">
            {{ row.label }}
            <p
              v-if="errors[row.day]"
              :id="idFor(row.day, 'error')"
              class="text-sm font-semibold text-brand-800"
            >
              {{ errors[row.day] }}
            </p>
          </th>
          <td class="py-2 pr-3">
            <input
              v-model="row.works"
              type="checkbox"
              :aria-label="`${row.label}: pracuje`"
              class="size-5 accent-brand-600"
            />
          </td>
          <td class="py-2 pr-3">
            <select
              v-model="row.start"
              :disabled="!row.works"
              :aria-label="`${row.label}: od`"
              :aria-invalid="errors[row.day] ? 'true' : undefined"
              :aria-describedby="errors[row.day] ? idFor(row.day, 'error') : undefined"
              class="min-h-10 rounded-lg border-[1.5px] border-line bg-white px-2 disabled:opacity-40"
            >
              <option v-for="t in TIME_OPTIONS" :key="t" :value="t">{{ t }}</option>
            </select>
          </td>
          <td class="py-2">
            <select
              v-model="row.end"
              :disabled="!row.works"
              :aria-label="`${row.label}: do`"
              :aria-invalid="errors[row.day] ? 'true' : undefined"
              :aria-describedby="errors[row.day] ? idFor(row.day, 'error') : undefined"
              class="min-h-10 rounded-lg border-[1.5px] border-line bg-white px-2 disabled:opacity-40"
            >
              <option v-for="t in TIME_OPTIONS" :key="t" :value="t">{{ t }}</option>
            </select>
          </td>
        </tr>
      </tbody>
    </table>

    <ConflictList
      v-if="conflicts.length"
      :conflicts="conflicts"
      :services="services"
      cause="schedule"
    />
    <p v-if="savedMessage" role="status" class="font-semibold text-ok-800">{{ savedMessage }}</p>
    <p v-if="saveError" role="alert" class="font-semibold text-brand-800">{{ saveError }}</p>

    <div class="flex flex-wrap gap-3">
      <button
        type="submit"
        :disabled="!dirty || hasErrors || saving"
        class="min-h-11 rounded-full bg-brand-600 px-5 font-bold text-white enabled:hover:bg-brand-700 disabled:opacity-50"
      >
        {{ saving ? 'Zapisuję…' : 'Zapisz godziny' }}
      </button>
      <button
        v-if="dirty"
        type="button"
        class="min-h-11 rounded-full border-[1.5px] border-line px-5 font-semibold hover:border-ink-soft"
        @click="reset"
      >
        Cofnij zmiany
      </button>
    </div>
  </form>
</template>
