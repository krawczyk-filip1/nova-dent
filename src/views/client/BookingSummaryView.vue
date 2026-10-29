<script setup lang="ts">
import { ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { ApiError } from '@/api/client'
import { createBooking } from '@/api/public'
import BookingDraftCard from '@/components/booking/BookingDraftCard.vue'
import BookingSteps from '@/components/booking/BookingSteps.vue'
import { useBookingDraft } from '@/composables/useBookingDraft'
import type { ValidationErrorBody } from '@/types/api'
import { formatPhone } from '@/utils/phone'

const router = useRouter()
const { flow, lines } = useBookingDraft()

type SubmitError =
  | { kind: 'conflict'; message: string }
  | { kind: 'validation'; message: string; fields: string[] }
  | { kind: 'other'; message: string }

const submitting = ref(false)
const submitError = ref<SubmitError | null>(null)

async function confirm() {
  const { serviceId, slot, customer } = flow
  if (!serviceId || !slot || !customer || submitting.value) return

  submitting.value = true
  submitError.value = null
  try {
    const booking = await createBooking({
      serviceId,
      employeeId: slot.employeeId,
      start: slot.start,
      customer,
    })
    flow.complete(booking)
    // replace: przycisk "Wstecz" nie wraca do podsumowania już zapisanej rezerwacji.
    await router.replace({ name: 'booking-confirmation', params: { code: booking.code } })
  } catch (e) {
    submitError.value = toSubmitError(e)
  } finally {
    submitting.value = false
  }
}

function toSubmitError(e: unknown): SubmitError {
  if (e instanceof ApiError && e.status === 409) return { kind: 'conflict', message: e.message }
  if (e instanceof ApiError && e.status === 422) {
    const body = e.body as ValidationErrorBody | null
    return {
      kind: 'validation',
      message: e.message,
      fields: Object.values(body?.fieldErrors ?? {}),
    }
  }
  const message = e instanceof Error ? e.message : 'Nieznany błąd.'
  return { kind: 'other', message: `Nie udało się zapisać rezerwacji. ${message}` }
}

function chooseAnotherSlot() {
  flow.selectSlot(null)
  void router.push({ name: 'booking-slot' })
}
</script>

<template>
  <div class="flex flex-col gap-6 pt-2">
    <BookingSteps :current="3" />
    <h1 class="text-3xl font-extrabold tracking-tight sm:text-4xl">Sprawdź i potwierdź</h1>

    <BookingDraftCard :lines="lines" editable />

    <section
      v-if="flow.customer"
      aria-labelledby="pacjent-naglowek"
      class="flex flex-wrap items-start justify-between gap-4 rounded-3xl border-[1.5px] border-sand-100 p-5 sm:p-6"
    >
      <div class="flex flex-col gap-1">
        <h2 id="pacjent-naglowek" class="text-lg font-bold">Pacjent</h2>
        <dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-ink-muted">
          <dt class="font-semibold text-ink">Imię i nazwisko</dt>
          <dd>{{ flow.customer.name }}</dd>
          <dt class="font-semibold text-ink">E-mail</dt>
          <dd class="break-all">{{ flow.customer.email }}</dd>
          <dt class="font-semibold text-ink">Telefon</dt>
          <dd>{{ formatPhone(flow.customer.phone) }}</dd>
          <template v-if="flow.customer.notes">
            <dt class="font-semibold text-ink">Uwagi</dt>
            <dd class="whitespace-pre-line">{{ flow.customer.notes }}</dd>
          </template>
        </dl>
      </div>
      <RouterLink :to="{ name: 'booking-details' }" class="font-semibold text-brand-700 underline">
        Zmień dane
      </RouterLink>
    </section>

    <p class="max-w-2xl text-ink-muted">
      Po potwierdzeniu rezerwacja trafi do gabinetu i będzie czekać na akceptację – zwykle w ciągu
      kilku godzin. Odwołać ją możesz online najpóźniej 24 godziny przed wizytą, później
      telefonicznie.
    </p>

    <div
      v-if="submitError"
      role="alert"
      class="flex flex-col items-start gap-3 rounded-2xl bg-brand-100 p-5 text-brand-800"
    >
      <p class="font-semibold">{{ submitError.message }}</p>
      <ul
        v-if="submitError.kind === 'validation' && submitError.fields.length"
        class="list-disc pl-5"
      >
        <li v-for="field in submitError.fields" :key="field">{{ field }}</li>
      </ul>
      <button
        v-if="submitError.kind === 'conflict'"
        type="button"
        class="rounded-full bg-brand-600 px-5 py-2.5 font-bold text-white hover:bg-brand-700"
        @click="chooseAnotherSlot"
      >
        Wybierz inny termin
      </button>
      <RouterLink
        v-else-if="submitError.kind === 'validation'"
        :to="{ name: 'booking-details' }"
        class="font-semibold underline"
      >
        Popraw dane
      </RouterLink>
    </div>

    <div class="flex flex-wrap items-center gap-4">
      <button
        type="button"
        :disabled="submitting"
        :aria-busy="submitting"
        class="min-h-12 rounded-full bg-brand-600 px-7 font-bold text-white hover:bg-brand-700 disabled:cursor-wait disabled:opacity-60"
        @click="confirm"
      >
        {{ submitting ? 'Zapisuję…' : 'Potwierdź rezerwację' }}
      </button>
    </div>
  </div>
</template>
