<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import StatusBadge from '@/components/booking/StatusBadge.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import { formatClinicDay, formatClinicTime, toClinicDateKey } from '@/lib/dates'
import type { Booking, BookingStatus, Employee, Service } from '@/types/models'
import { employeeLabel } from '@/utils/employees'
import { formatServicePrice } from '@/utils/money'
import { formatPhone } from '@/utils/phone'
import { ALLOWED_TRANSITIONS, STATUS_LABELS } from '@/utils/transitions'

const props = defineProps<{
  booking: Booking | null
  employees: Employee[]
  services: Service[]
  now: Date
  busy: boolean
  error: string | null
}>()
const emit = defineEmits<{ close: []; changeStatus: [status: BookingStatus] }>()

const ACTION_LABELS: Record<BookingStatus, string> = {
  pending: '',
  confirmed: 'Potwierdź',
  completed: 'Oznacz jako zakończoną',
  cancelled: 'Odwołaj wizytę',
}

const confirmingCancel = ref(false)
watch(
  () => props.booking?.id,
  () => (confirmingCancel.value = false),
)

const details = computed(() => {
  const b = props.booking
  if (!b) return null
  const service = props.services.find((s) => s.id === b.serviceId)
  const employee = props.employees.find((e) => e.id === b.employeeId)
  return {
    when: `${formatClinicDay(toClinicDateKey(b.start), 'EEEE, d MMMM yyyy')}, ${formatClinicTime(b.start)}–${formatClinicTime(b.end)}`,
    service: service ? `${service.name} · ${formatServicePrice(service)}` : '–',
    employee: employee ? employeeLabel(employee) : '–',
    history: b.statusHistory.map((h) => ({
      label: STATUS_LABELS[h.status],
      at: `${formatClinicDay(toClinicDateKey(h.changedAt), 'd MMM')}, ${formatClinicTime(h.changedAt)}`,
    })),
  }
})

const actions = computed(() => {
  const b = props.booking
  if (!b) return []
  const started = Date.parse(b.start) <= props.now.getTime()
  return ALLOWED_TRANSITIONS[b.status]
    .filter((s) => s !== 'completed' || started)
    .map((status) => ({ status, label: ACTION_LABELS[status] }))
})
const completeLaterHint = computed(
  () =>
    props.booking?.status === 'confirmed' && Date.parse(props.booking.start) > props.now.getTime(),
)

function act(status: BookingStatus) {
  if (status === 'cancelled' && !confirmingCancel.value) {
    confirmingCancel.value = true
    return
  }
  confirmingCancel.value = false
  emit('changeStatus', status)
}
</script>

<template>
  <BaseModal :open="!!booking" :title="booking ? booking.customer.name : ''" @close="emit('close')">
    <div v-if="booking && details" class="flex flex-col gap-5">
      <div class="flex flex-wrap items-center gap-3">
        <StatusBadge :status="booking.status" />
        <span class="font-mono text-sm text-ink-muted">{{ booking.code }}</span>
      </div>

      <dl class="grid grid-cols-[auto_1fr] gap-x-5 gap-y-2">
        <dt class="font-semibold">Termin</dt>
        <dd class="text-ink-muted">{{ details.when }}</dd>
        <dt class="font-semibold">Usługa</dt>
        <dd class="text-ink-muted">{{ details.service }}</dd>
        <dt class="font-semibold">Lekarz</dt>
        <dd class="text-ink-muted">{{ details.employee }}</dd>
        <dt class="font-semibold">Telefon</dt>
        <dd>
          <a :href="`tel:${booking.customer.phone}`" class="text-brand-700 underline">{{
            formatPhone(booking.customer.phone)
          }}</a>
        </dd>
        <dt class="font-semibold">E-mail</dt>
        <dd class="break-all">
          <a :href="`mailto:${booking.customer.email}`" class="text-brand-700 underline">{{
            booking.customer.email
          }}</a>
        </dd>
        <template v-if="booking.customer.notes">
          <dt class="font-semibold">Uwagi</dt>
          <dd class="whitespace-pre-line text-ink-muted">{{ booking.customer.notes }}</dd>
        </template>
      </dl>

      <details class="text-sm">
        <summary class="cursor-pointer font-semibold">Historia zmian</summary>
        <ol class="mt-2 flex flex-col gap-1 text-ink-muted">
          <li v-for="(entry, index) in details.history" :key="index">
            {{ entry.at }} – {{ entry.label }}
          </li>
        </ol>
      </details>

      <p
        v-if="error"
        role="alert"
        class="rounded-2xl bg-brand-100 p-3 font-semibold text-brand-800"
      >
        {{ error }}
      </p>
    </div>

    <template #footer>
      <div v-if="booking" class="flex flex-col gap-3">
        <p v-if="confirmingCancel" class="font-semibold">
          Na pewno odwołać? Termin wróci do puli i będzie można go zarezerwować.
        </p>
        <p v-else-if="completeLaterHint" class="text-sm text-ink-muted">
          „Zakończoną” można oznaczyć wizytę dopiero od jej rozpoczęcia.
        </p>
        <div class="flex flex-wrap gap-3">
          <button
            v-for="action in actions"
            :key="action.status"
            type="button"
            :disabled="busy"
            class="min-h-11 rounded-full px-5 font-bold disabled:cursor-wait disabled:opacity-60"
            :class="
              action.status === 'cancelled'
                ? 'border-[1.5px] border-brand-600 text-brand-700 hover:bg-brand-100'
                : 'bg-brand-600 text-white hover:bg-brand-700'
            "
            @click="act(action.status)"
          >
            {{ action.status === 'cancelled' && confirmingCancel ? 'Tak, odwołaj' : action.label }}
          </button>
          <button
            v-if="confirmingCancel"
            type="button"
            class="min-h-11 rounded-full border-[1.5px] border-line px-5 font-semibold"
            @click="confirmingCancel = false"
          >
            Nie
          </button>
          <p v-if="actions.length === 0" class="text-sm text-ink-muted">
            Status „{{ STATUS_LABELS[booking.status] }}” jest ostateczny.
          </p>
        </div>
      </div>
    </template>
  </BaseModal>
</template>
