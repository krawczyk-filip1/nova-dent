<script setup lang="ts">
import { nextTick, ref, useTemplateRef } from 'vue'
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import { ApiError } from '@/api/client'
import { createService, updateService } from '@/api/admin'
import BaseModal from '@/components/ui/BaseModal.vue'
import CheckboxField from '@/components/ui/CheckboxField.vue'
import SelectField from '@/components/ui/SelectField.vue'
import TextField from '@/components/ui/TextField.vue'
import {
  DURATION_OPTIONS,
  formatPriceInput,
  serviceFormSchema,
  toServiceInput,
} from '@/schemas/service'
import type { ValidationErrorBody } from '@/types/api'
import type { Employee, Service } from '@/types/models'
import { employeeLabel } from '@/utils/employees'
import { formatDuration } from '@/utils/money'

// Komponent montowany na nowo przy każdym otwarciu (v-if + key w rodzicu), więc wartości
// początkowe wystarczy ustawić raz - bez ręcznego resetowania formularza.
const props = defineProps<{ service: Service | null; employees: Employee[] }>()
const emit = defineEmits<{ close: []; saved: [service: Service] }>()
const form = useTemplateRef<HTMLFormElement>('form')

const s = props.service
const { handleSubmit, errors, defineField, isSubmitting, setErrors } = useForm({
  validationSchema: toTypedSchema(serviceFormSchema),
  initialValues: {
    name: s?.name ?? '',
    description: s?.description ?? '',
    durationMin: s?.durationMin ?? 30,
    price: s ? formatPriceInput(s.priceGrosze) : '',
    priceFrom: s?.priceFrom ?? false,
    active: s?.active ?? true,
    employeeIds: s
      ? props.employees.filter((e) => e.serviceIds.includes(s.id)).map((e) => e.id)
      : [],
  },
})
const lazyThenEager = (state: { errors: string[] }) => ({
  validateOnModelUpdate: state.errors.length > 0,
})
const [name, nameAttrs] = defineField('name', lazyThenEager)
const [description, descriptionAttrs] = defineField('description', lazyThenEager)
const [durationMin, durationAttrs] = defineField('durationMin')
const [price, priceAttrs] = defineField('price', lazyThenEager)
const [priceFrom] = defineField('priceFrom')
const [active] = defineField('active')
const [employeeIds] = defineField('employeeIds')

const durationOptions = DURATION_OPTIONS.map((m) => ({ value: m, label: formatDuration(m) }))
const formError = ref<string | null>(null)

const onSubmit = handleSubmit(
  async (values) => {
    formError.value = null
    const input = toServiceInput(values)
    try {
      const saved = s ? await updateService(s.id, input) : await createService(input)
      emit('saved', saved)
    } catch (e) {
      if (e instanceof ApiError && e.status === 422) {
        // Błędy z serwera trafiają pod właściwe pola (cena w API to priceGrosze, w formularzu - price).
        const { priceGrosze, ...rest } = (e.body as ValidationErrorBody | null)?.fieldErrors ?? {}
        setErrors({ ...rest, ...(priceGrosze ? { price: priceGrosze } : {}) })
      }
      formError.value = e instanceof Error ? e.message : 'Nie udało się zapisać usługi.'
    }
  },
  async () => {
    await nextTick()
    form.value?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
  },
)
</script>

<template>
  <BaseModal
    :open="true"
    :title="service ? `Edycja: ${service.name}` : 'Nowa usługa'"
    @close="emit('close')"
  >
    <form id="service-form" ref="form" novalidate class="flex flex-col gap-5" @submit="onSubmit">
      <TextField v-model="name" v-bind="nameAttrs" label="Nazwa" :error="errors.name" />
      <TextField
        v-model="description"
        v-bind="descriptionAttrs"
        label="Opis dla pacjenta (opcjonalnie)"
        :error="errors.description"
        multiline
        maxlength="200"
      />
      <div class="grid gap-5 sm:grid-cols-2">
        <SelectField
          v-model="durationMin"
          v-bind="durationAttrs"
          label="Czas trwania"
          :options="durationOptions"
          :error="errors.durationMin"
        />
        <TextField
          v-model="price"
          v-bind="priceAttrs"
          label="Cena (zł)"
          :error="errors.price"
          inputmode="decimal"
          placeholder="np. 350 lub 99,50"
        />
      </div>
      <CheckboxField v-model="priceFrom">Cena orientacyjna – pokazuj jako „od …”</CheckboxField>
      <CheckboxField v-model="active">Dostępna do rezerwacji online</CheckboxField>

      <fieldset
        class="flex flex-col gap-2"
        :aria-describedby="errors.employeeIds ? 'kto-blad' : undefined"
      >
        <legend class="pb-1 text-sm font-semibold">Kto wykonuje</legend>
        <label
          v-for="employee in employees"
          :key="employee.id"
          class="flex min-h-9 items-center gap-3"
        >
          <input
            v-model="employeeIds"
            type="checkbox"
            :value="employee.id"
            :aria-invalid="errors.employeeIds ? 'true' : undefined"
            class="size-5 accent-brand-600"
          />
          {{ employeeLabel(employee) }}
        </label>
        <p v-if="errors.employeeIds" id="kto-blad" class="text-sm font-semibold text-brand-800">
          {{ errors.employeeIds }}
        </p>
      </fieldset>

      <p
        v-if="formError"
        role="alert"
        class="rounded-2xl bg-brand-100 p-3 font-semibold text-brand-800"
      >
        {{ formError }}
      </p>
    </form>

    <template #footer>
      <div class="flex flex-wrap gap-3">
        <button
          type="submit"
          form="service-form"
          :disabled="isSubmitting"
          class="min-h-11 rounded-full bg-brand-600 px-5 font-bold text-white hover:bg-brand-700 disabled:cursor-wait disabled:opacity-60"
        >
          {{ isSubmitting ? 'Zapisuję…' : service ? 'Zapisz zmiany' : 'Dodaj usługę' }}
        </button>
        <button
          type="button"
          class="min-h-11 rounded-full border-[1.5px] border-line px-5 font-semibold hover:border-ink-soft"
          @click="emit('close')"
        >
          Anuluj
        </button>
      </div>
    </template>
  </BaseModal>
</template>
