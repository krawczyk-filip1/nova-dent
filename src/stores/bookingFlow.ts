import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import type { Booking, Customer } from '@/types/models'

export interface ChosenSlot {
  start: string
  end: string
  employeeId: string
}

interface FlowState {
  serviceId: string | null
  employeeId: string
  slot: ChosenSlot | null
  customer: Customer | null
  lastBooking: Booking | null
}

// sessionStorage: kreator przeżyje odświeżenie strony, ale zniknie po zamknięciu karty -
// dane pacjenta nie zostają na komputerze dłużej, niż trzeba.
export const FLOW_STORAGE_KEY = 'nova-dent:flow:v1'

const emptyState = (): FlowState => ({
  serviceId: null,
  employeeId: 'any',
  slot: null,
  customer: null,
  lastBooking: null,
})

function loadState(): FlowState {
  try {
    const raw = sessionStorage.getItem(FLOW_STORAGE_KEY)
    if (raw) return { ...emptyState(), ...(JSON.parse(raw) as Partial<FlowState>) }
  } catch {}
  return emptyState()
}

export const useBookingFlowStore = defineStore('bookingFlow', () => {
  const initial = loadState()
  const serviceId = ref(initial.serviceId)
  const employeeId = ref(initial.employeeId)
  const slot = ref(initial.slot)
  const customer = ref(initial.customer)
  const lastBooking = ref(initial.lastBooking)

  const hasService = computed(() => serviceId.value !== null)
  const hasSlot = computed(() => slot.value !== null)
  const hasCustomer = computed(() => customer.value !== null)

  // Zmiana wcześniejszego kroku unieważnia późniejsze: inna usługa -> inny czas trwania i inni lekarze.
  function selectService(id: string) {
    if (serviceId.value === id) return
    serviceId.value = id
    employeeId.value = 'any'
    slot.value = null
  }

  function selectEmployee(id: string) {
    if (employeeId.value === id) return
    employeeId.value = id
    slot.value = null
  }

  function selectSlot(chosen: ChosenSlot | null) {
    slot.value = chosen
  }

  function setCustomer(data: Customer) {
    customer.value = data
  }

  function reset() {
    const fresh = emptyState()
    serviceId.value = fresh.serviceId
    employeeId.value = fresh.employeeId
    slot.value = fresh.slot
    customer.value = fresh.customer
    lastBooking.value = fresh.lastBooking
  }

  function complete(booking: Booking) {
    reset()
    lastBooking.value = booking
  }

  const state = (): FlowState => ({
    serviceId: serviceId.value,
    employeeId: employeeId.value,
    slot: slot.value,
    customer: customer.value,
    lastBooking: lastBooking.value,
  })

  watch(
    state,
    (value) => {
      try {
        sessionStorage.setItem(FLOW_STORAGE_KEY, JSON.stringify(value))
      } catch {}
    },
    { deep: true },
  )

  return {
    serviceId,
    employeeId,
    slot,
    customer,
    lastBooking,
    hasService,
    hasSlot,
    hasCustomer,
    selectService,
    selectEmployee,
    selectSlot,
    setCustomer,
    reset,
    complete,
  }
})
