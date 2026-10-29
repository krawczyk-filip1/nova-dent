import { computed, onMounted, ref } from 'vue'
import { fetchEmployees } from '@/api/public'
import { formatClinicDay, formatClinicTime, toClinicDateKey } from '@/lib/dates'
import { useBookingFlowStore } from '@/stores/bookingFlow'
import { useServicesStore } from '@/stores/services'
import type { Employee } from '@/types/models'
import { employeeLabel } from '@/utils/employees'
import { formatDuration, formatServicePrice } from '@/utils/money'

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export function useBookingDraft() {
  const flow = useBookingFlowStore()
  const servicesStore = useServicesStore()
  const employees = ref<Employee[]>([])

  onMounted(async () => {
    void servicesStore.load()
    if (flow.serviceId) employees.value = await fetchEmployees(flow.serviceId).catch(() => [])
  })

  const service = computed(() =>
    flow.serviceId ? servicesStore.getById(flow.serviceId) : undefined,
  )
  const employee = computed(() => employees.value.find((e) => e.id === flow.slot?.employeeId))

  const lines = computed(() => {
    const slot = flow.slot
    return {
      service: service.value?.name ?? '…',
      details: service.value
        ? `${formatDuration(service.value.durationMin)} · ${formatServicePrice(service.value)}`
        : '',
      date: slot
        ? capitalize(formatClinicDay(toClinicDateKey(slot.start), 'EEEE, d MMMM yyyy'))
        : '',
      time: slot ? `${formatClinicTime(slot.start)}–${formatClinicTime(slot.end)}` : '',
      employee: employee.value ? employeeLabel(employee.value) : '…',
    }
  })

  return { flow, service, employee, lines }
}
