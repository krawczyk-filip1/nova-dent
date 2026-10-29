<script setup lang="ts">
import { computed, nextTick, onMounted, ref, useTemplateRef } from 'vue'
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import {
  createBlock,
  deleteBlock,
  fetchAdminEmployees,
  fetchAdminServices,
  fetchBlocks,
} from '@/api/admin'
import { ApiError } from '@/api/client'
import ConflictList from '@/components/admin/ConflictList.vue'
import CheckboxField from '@/components/ui/CheckboxField.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import SelectField from '@/components/ui/SelectField.vue'
import TextField from '@/components/ui/TextField.vue'
import {
  addDaysToKey,
  clinicToday,
  formatClinicDay,
  formatClinicTime,
  toClinicDateKey,
} from '@/lib/dates'
import { BLOCK_REASONS, blockFormSchema, toBlockInput } from '@/schemas/block'
import type { LoadStatus } from '@/stores/services'
import type { ValidationErrorBody } from '@/types/api'
import type { Booking, Employee, Service, TimeBlock } from '@/types/models'
import { employeeLabel } from '@/utils/employees'
import { TIME_OPTIONS } from '@/utils/schedule'
import { useCatalogChanged } from '@/composables/useCatalogChanged'

const today = clinicToday()
const RANGE = { from: addDaysToKey(today, -30), to: addDaysToKey(today, 180) }

const blocks = ref<TimeBlock[]>([])
const employees = ref<Employee[]>([])
const services = ref<Service[]>([])
const status = ref<LoadStatus>('idle')
const loadError = ref<string | null>(null)
const announcement = ref('')
const catalogChanged = useCatalogChanged()

async function load() {
  status.value = 'loading'
  try {
    ;[blocks.value, employees.value, services.value] = await Promise.all([
      fetchBlocks(RANGE),
      fetchAdminEmployees(),
      fetchAdminServices(),
    ])
    status.value = 'ready'
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : 'Nieznany błąd.'
    status.value = 'error'
  }
}
onMounted(load)

const nowIso = new Date().toISOString()
const upcoming = computed(() => blocks.value.filter((b) => b.end > nowIso))
const past = computed(() => blocks.value.filter((b) => b.end <= nowIso).reverse())

function who(block: TimeBlock) {
  if (block.employeeId === null) return 'Cały gabinet'
  const employee = employees.value.find((e) => e.id === block.employeeId)
  return employee ? employeeLabel(employee) : '–'
}

function when(block: TimeBlock) {
  const startDay = toClinicDateKey(block.start)
  const startTime = formatClinicTime(block.start)
  const endTime = formatClinicTime(block.end)
  if (startTime === '00:00' && endTime === '00:00') {
    const lastDay = addDaysToKey(toClinicDateKey(block.end), -1)
    return startDay === lastDay
      ? `${formatClinicDay(startDay, 'EEEE, d MMMM')} (cały dzień)`
      : `${formatClinicDay(startDay, 'd MMMM')} – ${formatClinicDay(lastDay, 'd MMMM')} (całe dni)`
  }
  const endDay = toClinicDateKey(block.end)
  return startDay === endDay
    ? `${formatClinicDay(startDay, 'EEEE, d MMMM')}, ${startTime}–${endTime}`
    : `${formatClinicDay(startDay, 'd MMMM')}, ${startTime} – ${formatClinicDay(endDay, 'd MMMM')}, ${endTime}`
}

const form = useTemplateRef<HTMLFormElement>('form')
const { handleSubmit, errors, defineField, isSubmitting, resetForm, setErrors } = useForm({
  validationSchema: toTypedSchema(blockFormSchema),
  initialValues: {
    employeeId: '',
    fromDate: today,
    toDate: today,
    allDay: true,
    fromTime: '12:00',
    toTime: '13:00',
    reason: 'vacation',
    note: '',
  },
})
const [employeeId] = defineField('employeeId')
const [fromDate, fromDateAttrs] = defineField('fromDate')
const [toDate, toDateAttrs] = defineField('toDate')
const [allDay] = defineField('allDay')
const [fromTime] = defineField('fromTime')
const [toTime] = defineField('toTime')
const [reason] = defineField('reason')
const [note] = defineField('note')

const whoOptions = computed(() => [
  { value: '', label: 'Cały gabinet (np. święto)' },
  ...employees.value.map((e) => ({ value: e.id, label: employeeLabel(e) })),
])
const reasonOptions = Object.entries(BLOCK_REASONS).map(([value, label]) => ({ value, label }))
const timeOptions = TIME_OPTIONS.map((t) => ({ value: t, label: t }))

const conflicts = ref<Booking[]>([])
const formError = ref<string | null>(null)

const onSubmit = handleSubmit(
  async (values) => {
    formError.value = null
    try {
      const result = await createBlock(toBlockInput(values))
      conflicts.value = result.conflicts
      announcement.value = 'Dodano blokadę.'
      resetForm()
      catalogChanged()
      await load()
    } catch (e) {
      if (e instanceof ApiError && e.status === 422) {
        setErrors((e.body as ValidationErrorBody | null)?.fieldErrors ?? {})
      }
      formError.value = e instanceof Error ? e.message : 'Nie udało się dodać blokady.'
    }
  },
  async () => {
    await nextTick()
    form.value?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
  },
)

const deleting = ref<TimeBlock | null>(null)
const deleteBusy = ref(false)
const deleteError = ref<string | null>(null)

async function confirmDelete() {
  if (!deleting.value) return
  deleteBusy.value = true
  deleteError.value = null
  try {
    await deleteBlock(deleting.value.id)
    blocks.value = blocks.value.filter((b) => b.id !== deleting.value!.id)
    announcement.value = 'Usunięto blokadę – terminy znów są dostępne.'
    deleting.value = null
    catalogChanged()
  } catch (e) {
    deleteError.value = e instanceof Error ? e.message : 'Nie udało się usunąć blokady.'
  } finally {
    deleteBusy.value = false
  }
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <header class="flex flex-col gap-1">
      <h1 class="text-3xl font-extrabold tracking-tight">Blokady</h1>
      <p class="text-ink-muted">
        Urlopy, przerwy i dni zamknięcia. W zablokowanym czasie pacjenci nie zobaczą wolnych
        terminów.
      </p>
    </header>
    <p role="status" class="sr-only">{{ announcement }}</p>

    <section
      aria-labelledby="nowa-blokada"
      class="flex flex-col gap-4 rounded-2xl bg-white p-5 ring-1 ring-line"
    >
      <h2 id="nowa-blokada" class="text-xl font-bold">Nowa blokada</h2>
      <form ref="form" novalidate class="flex flex-col gap-4" @submit="onSubmit">
        <div class="grid gap-4 sm:grid-cols-2">
          <SelectField v-model="employeeId" label="Kogo dotyczy" :options="whoOptions" />
          <SelectField v-model="reason" label="Powód" :options="reasonOptions" />
          <TextField
            v-model="fromDate"
            v-bind="fromDateAttrs"
            label="Od dnia"
            type="date"
            :error="errors.fromDate"
          />
          <TextField
            v-model="toDate"
            v-bind="toDateAttrs"
            label="Do dnia"
            type="date"
            :error="errors.toDate"
          />
        </div>
        <CheckboxField v-model="allDay">Całe dni</CheckboxField>
        <div v-if="!allDay" class="grid gap-4 sm:grid-cols-2">
          <SelectField v-model="fromTime" label="Od godziny" :options="timeOptions" />
          <SelectField
            v-model="toTime"
            label="Do godziny"
            :options="timeOptions"
            :error="errors.toTime"
          />
        </div>
        <TextField
          v-model="note"
          label="Notatka (opcjonalnie)"
          maxlength="120"
          placeholder="np. szkolenie z endodoncji"
        />
        <p
          v-if="formError"
          role="alert"
          class="rounded-2xl bg-brand-100 p-3 font-semibold text-brand-800"
        >
          {{ formError }}
        </p>
        <button
          type="submit"
          :disabled="isSubmitting"
          class="min-h-11 self-start rounded-full bg-brand-600 px-5 font-bold text-white hover:bg-brand-700 disabled:cursor-wait disabled:opacity-60"
        >
          {{ isSubmitting ? 'Dodaję…' : 'Dodaj blokadę' }}
        </button>
      </form>
      <ConflictList
        v-if="conflicts.length"
        :conflicts="conflicts"
        :services="services"
        cause="block"
      />
    </section>

    <p v-if="status === 'error'" role="alert" class="text-brand-800">
      Nie udało się pobrać blokad. {{ loadError }}
    </p>
    <section v-else aria-labelledby="lista-blokad" class="flex flex-col gap-3">
      <h2 id="lista-blokad" class="text-xl font-bold">Zaplanowane i trwające</h2>
      <p v-if="status === 'ready' && upcoming.length === 0" class="text-ink-muted">
        Brak blokad – wszyscy pracują według stałych godzin.
      </p>
      <ul class="flex flex-col gap-2">
        <li
          v-for="block in upcoming"
          :key="block.id"
          class="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3 ring-1 ring-line"
        >
          <div class="flex flex-col">
            <span class="font-semibold first-letter:uppercase">{{ when(block) }}</span>
            <span class="text-sm text-ink-muted">
              {{ who(block) }} · {{ BLOCK_REASONS[block.reason]
              }}<template v-if="block.note"> · {{ block.note }}</template>
            </span>
          </div>
          <button
            type="button"
            class="min-h-10 rounded-full px-3 font-semibold text-brand-700 hover:bg-brand-100"
            :aria-label="`Usuń blokadę: ${who(block)}, ${when(block)}`"
            @click="((deleting = block), (deleteError = null))"
          >
            Usuń
          </button>
        </li>
      </ul>
      <details v-if="past.length" class="pt-2">
        <summary class="cursor-pointer font-semibold">Minione ({{ past.length }})</summary>
        <ul class="mt-2 flex flex-col gap-1 text-sm text-ink-muted">
          <li v-for="block in past" :key="block.id">{{ when(block) }} – {{ who(block) }}</li>
        </ul>
      </details>
    </section>

    <ConfirmDialog
      :open="!!deleting"
      title="Usunąć blokadę?"
      confirm-label="Tak, usuń"
      :busy="deleteBusy"
      :error="deleteError"
      @confirm="confirmDelete"
      @cancel="deleting = null"
    >
      <p v-if="deleting">
        {{ who(deleting) }}, {{ when(deleting) }}. Terminy w tym czasie znów będą dostępne dla
        pacjentów.
      </p>
    </ConfirmDialog>
  </div>
</template>
