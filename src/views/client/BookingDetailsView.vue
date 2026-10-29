<script setup lang="ts">
import { nextTick, useTemplateRef } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import BookingDraftCard from '@/components/booking/BookingDraftCard.vue'
import BookingSteps from '@/components/booking/BookingSteps.vue'
import CheckboxField from '@/components/ui/CheckboxField.vue'
import TextField from '@/components/ui/TextField.vue'
import { useBookingDraft } from '@/composables/useBookingDraft'
import { CLINIC } from '@/constants/clinic'
import { customerFormSchema, NOTES_MAX } from '@/schemas/customer'

const router = useRouter()
const { flow, lines } = useBookingDraft()
const form = useTemplateRef<HTMLFormElement>('form')

const { handleSubmit, errors, defineField, isSubmitting } = useForm({
  validationSchema: toTypedSchema(customerFormSchema),
  initialValues: {
    name: flow.customer?.name ?? '',
    email: flow.customer?.email ?? '',
    phone: flow.customer?.phone ?? '',
    notes: flow.customer?.notes ?? '',
    consent: flow.customer ? true : undefined,
  },
})

// Walidacja "najpierw łagodnie": przy opuszczeniu pola, a gdy pole ma już błąd - przy każdym znaku,
// żeby komunikat zniknął od razu po poprawce.
const lazyThenEager = (state: { errors: string[] }) => ({
  validateOnModelUpdate: state.errors.length > 0,
})
const [name, nameAttrs] = defineField('name', lazyThenEager)
const [email, emailAttrs] = defineField('email', lazyThenEager)
const [phone, phoneAttrs] = defineField('phone', lazyThenEager)
const [notes, notesAttrs] = defineField('notes', lazyThenEager)
const [consent, consentAttrs] = defineField('consent')

const onSubmit = handleSubmit(
  (values) => {
    flow.setCustomer({
      name: values.name,
      email: values.email,
      phone: values.phone,
      notes: values.notes,
    })
    void router.push({ name: 'booking-summary' })
  },
  async () => {
    await nextTick()
    form.value?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
  },
)
</script>

<template>
  <div class="flex flex-col gap-6 pt-2">
    <BookingSteps :current="2" />
    <h1 class="text-3xl font-extrabold tracking-tight sm:text-4xl">Twoje dane</h1>
    <BookingDraftCard :lines="lines" editable />

    <form
      ref="form"
      novalidate
      class="flex max-w-2xl flex-col gap-5"
      aria-describedby="dane-wyjasnienie"
      @submit="onSubmit"
    >
      <p id="dane-wyjasnienie" class="text-ink-muted">
        Potrzebujemy ich, żeby potwierdzić wizytę i przypomnieć o niej dzień wcześniej.
      </p>

      <TextField
        v-model="name"
        v-bind="nameAttrs"
        label="Imię i nazwisko"
        :error="errors.name"
        autocomplete="name"
      />
      <div class="grid gap-5 sm:grid-cols-2">
        <TextField
          v-model="email"
          v-bind="emailAttrs"
          label="E-mail"
          :error="errors.email"
          type="email"
          inputmode="email"
          autocomplete="email"
          hint="Wyślemy na niego kod rezerwacji."
        />
        <TextField
          v-model="phone"
          v-bind="phoneAttrs"
          label="Telefon"
          :error="errors.phone"
          type="tel"
          inputmode="tel"
          autocomplete="tel"
          hint="Na ten numer przyjdzie SMS z potwierdzeniem."
        />
      </div>
      <TextField
        v-model="notes"
        v-bind="notesAttrs"
        label="Uwagi dla lekarza (opcjonalnie)"
        :error="errors.notes"
        multiline
        :maxlength="NOTES_MAX"
        hint="Np. ból zęba, uczulenie na leki, lęk przed zabiegiem."
      />
      <CheckboxField v-model="consent" v-bind="consentAttrs" :error="errors.consent">
        Zgadzam się na przetwarzanie moich danych przez {{ CLINIC.name }} w celu umówienia wizyty.
        To wersja demonstracyjna – dane zostają tylko w Twojej przeglądarce.
      </CheckboxField>

      <div class="flex flex-wrap items-center gap-4 pt-2">
        <button
          type="submit"
          :disabled="isSubmitting"
          class="min-h-12 rounded-full bg-brand-600 px-7 font-bold text-white hover:bg-brand-700 disabled:opacity-50"
        >
          Dalej: podsumowanie
        </button>
        <RouterLink :to="{ name: 'booking-slot' }" class="font-semibold text-brand-700 underline">
          Wróć do wyboru terminu
        </RouterLink>
      </div>
    </form>
  </div>
</template>
