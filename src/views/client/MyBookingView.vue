<script setup lang="ts">
import { computed, nextTick, ref, useTemplateRef } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import { ApiError } from '@/api/client'
import { cancelBooking, lookupBooking } from '@/api/public'
import StatusBadge from '@/components/booking/StatusBadge.vue'
import TextField from '@/components/ui/TextField.vue'
import { CLINIC } from '@/constants/clinic'
import { formatClinicDay, formatClinicTime, toClinicDateKey } from '@/lib/dates'
import { lookupSchema } from '@/schemas/lookup'
import type { PatientBooking } from '@/types/api'

const route = useRoute()
const resultHeading = useTemplateRef<HTMLElement>('resultHeading')

const { handleSubmit, errors, defineField, isSubmitting } = useForm({
  validationSchema: toTypedSchema(lookupSchema),
  initialValues: { code: typeof route.query.kod === 'string' ? route.query.kod : '', email: '' },
})
const lazyThenEager = (state: { errors: string[] }) => ({
  validateOnModelUpdate: state.errors.length > 0,
})
const [code, codeAttrs] = defineField('code', lazyThenEager)
const [email, emailAttrs] = defineField('email', lazyThenEager)

const result = ref<PatientBooking | null>(null)
const credentials = ref<{ code: string; email: string } | null>(null)
const lookupError = ref<string | null>(null)

const onLookup = handleSubmit(async (values) => {
  lookupError.value = null
  try {
    result.value = await lookupBooking(values.code, values.email)
    credentials.value = { code: values.code, email: values.email }
    resetCancel()
    await nextTick()
    resultHeading.value?.focus()
  } catch (e) {
    lookupError.value =
      e instanceof ApiError && e.status === 404
        ? e.message
        : `Nie udało się sprawdzić rezerwacji. ${e instanceof Error ? e.message : ''}`
  }
})

function searchAgain() {
  result.value = null
  credentials.value = null
  resetCancel()
}

const details = computed(() => {
  if (!result.value) return null
  const { booking, serviceName, employeeName, cancelDeadline } = result.value
  return {
    service: serviceName,
    employee: employeeName,
    when: `${formatClinicDay(toClinicDateKey(booking.start), 'EEEE, d MMMM yyyy')}, ${formatClinicTime(booking.start)}`,
    deadline: `${formatClinicDay(toClinicDateKey(cancelDeadline), 'd MMMM')}, ${formatClinicTime(cancelDeadline)}`,
  }
})

const tooLateToCancel = computed(
  () =>
    !!result.value &&
    !result.value.canCancel &&
    ['pending', 'confirmed'].includes(result.value.booking.status),
)

const confirmingCancel = ref(false)
const cancelling = ref(false)
const cancelError = ref<string | null>(null)
const justCancelled = ref(false)

function resetCancel() {
  confirmingCancel.value = false
  cancelError.value = null
  justCancelled.value = false
}

async function confirmCancel() {
  if (!credentials.value || cancelling.value) return
  cancelling.value = true
  cancelError.value = null
  try {
    result.value = await cancelBooking(credentials.value.code, credentials.value.email)
    confirmingCancel.value = false
    justCancelled.value = true
  } catch (e) {
    cancelError.value = e instanceof Error ? e.message : 'Nie udało się odwołać wizyty.'
    // 409 = stan się zmienił (np. minął termin 24 h) - odświeżamy, żeby ekran pokazywał prawdę.
    if (e instanceof ApiError && e.status === 409) {
      result.value = await lookupBooking(credentials.value.code, credentials.value.email).catch(
        () => result.value,
      )
      confirmingCancel.value = false
    }
  } finally {
    cancelling.value = false
  }
}
</script>

<template>
  <div class="flex max-w-2xl flex-col gap-6 pt-2">
    <h1 class="text-3xl font-extrabold tracking-tight sm:text-4xl">Moja rezerwacja</h1>

    <form v-if="!result" novalidate class="flex flex-col gap-5" @submit="onLookup">
      <p class="text-ink-muted">
        Podaj kod z potwierdzenia rezerwacji i adres e-mail podany przy rezerwacji.
      </p>
      <div class="grid gap-5 sm:grid-cols-2">
        <TextField
          v-model="code"
          v-bind="codeAttrs"
          label="Kod rezerwacji"
          :error="errors.code"
          autocomplete="off"
          autocapitalize="characters"
          spellcheck="false"
          placeholder="BK-7F3K9Q"
        />
        <TextField
          v-model="email"
          v-bind="emailAttrs"
          label="E-mail"
          :error="errors.email"
          type="email"
          inputmode="email"
          autocomplete="email"
        />
      </div>
      <p
        v-if="lookupError"
        role="alert"
        class="rounded-2xl bg-brand-100 p-4 font-semibold text-brand-800"
      >
        {{ lookupError }}
      </p>
      <button
        type="submit"
        :disabled="isSubmitting"
        class="min-h-12 self-start rounded-full bg-brand-600 px-7 font-bold text-white hover:bg-brand-700 disabled:cursor-wait disabled:opacity-60"
      >
        {{ isSubmitting ? 'Sprawdzam…' : 'Sprawdź rezerwację' }}
      </button>
    </form>

    <section v-else-if="details" aria-labelledby="wynik-naglowek" class="flex flex-col gap-5">
      <div class="flex flex-col gap-3 rounded-3xl bg-sand-100 p-6">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <h2
            id="wynik-naglowek"
            ref="resultHeading"
            tabindex="-1"
            class="font-mono text-2xl font-bold tracking-wider text-brand-700"
          >
            {{ result!.booking.code }}
          </h2>
          <StatusBadge :status="result!.booking.status" />
        </div>
        <dl class="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2">
          <dt class="font-semibold">Usługa</dt>
          <dd class="text-ink-muted">{{ details.service }}</dd>
          <dt class="font-semibold">Termin</dt>
          <dd class="text-ink-muted">{{ details.when }}</dd>
          <dt class="font-semibold">Lekarz</dt>
          <dd class="text-ink-muted">{{ details.employee }}</dd>
          <dt class="font-semibold">Pacjent</dt>
          <dd class="text-ink-muted">{{ result!.booking.customer.name }}</dd>
        </dl>
      </div>

      <p
        v-if="justCancelled"
        role="status"
        class="rounded-2xl bg-ok-100 p-4 font-semibold text-ok-800"
      >
        Wizyta odwołana. Termin wrócił do puli – dziękujemy za informację.
      </p>

      <p
        v-if="cancelError"
        role="alert"
        class="rounded-2xl bg-brand-100 p-4 font-semibold text-brand-800"
      >
        {{ cancelError }}
      </p>

      <div v-if="result!.canCancel" class="flex flex-col items-start gap-3">
        <p class="text-ink-muted">
          Online możesz odwołać wizytę do <strong class="text-ink">{{ details.deadline }}</strong
          >.
        </p>
        <button
          v-if="!confirmingCancel"
          type="button"
          class="min-h-12 rounded-full border-[1.5px] border-brand-600 px-6 font-bold text-brand-700 hover:bg-brand-100"
          @click="confirmingCancel = true"
        >
          Odwołaj wizytę
        </button>
        <div
          v-else
          role="group"
          aria-labelledby="odwolanie-pytanie"
          class="flex flex-col gap-3 rounded-2xl border-[1.5px] border-brand-600 p-4"
        >
          <p id="odwolanie-pytanie" class="font-semibold">
            Na pewno odwołać wizytę? Tego nie da się cofnąć – trzeba będzie zarezerwować nowy
            termin.
          </p>
          <div class="flex flex-wrap gap-3">
            <button
              type="button"
              :disabled="cancelling"
              class="min-h-11 rounded-full bg-brand-600 px-5 font-bold text-white hover:bg-brand-700 disabled:cursor-wait disabled:opacity-60"
              @click="confirmCancel"
            >
              {{ cancelling ? 'Odwołuję…' : 'Tak, odwołaj' }}
            </button>
            <button
              type="button"
              :disabled="cancelling"
              class="min-h-11 rounded-full border-[1.5px] border-line px-5 font-semibold hover:border-ink-soft"
              @click="confirmingCancel = false"
            >
              Nie, zostaw
            </button>
          </div>
        </div>
      </div>

      <p v-else-if="tooLateToCancel" class="text-ink-muted">
        Do wizyty zostało mniej niż 24 godziny, więc odwołać ją można już tylko telefonicznie:
        <a :href="CLINIC.phoneHref" class="font-semibold text-brand-700 underline">{{
          CLINIC.phoneDisplay
        }}</a
        >.
      </p>

      <div class="flex flex-wrap gap-4 pt-2">
        <button type="button" class="font-semibold text-brand-700 underline" @click="searchAgain">
          Sprawdź inną rezerwację
        </button>
        <RouterLink :to="{ name: 'services' }" class="font-semibold text-brand-700 underline">
          Umów nową wizytę
        </RouterLink>
      </div>
    </section>
  </div>
</template>
