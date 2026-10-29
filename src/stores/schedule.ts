import { ref } from 'vue'
import { defineStore } from 'pinia'
import {
  fetchAdminBookings,
  fetchAdminEmployees,
  fetchAdminServices,
  updateBookingStatus,
} from '@/api/admin'
import type { DateKey } from '@/lib/dates'
import type { Booking, BookingStatus, Employee, Service } from '@/types/models'
import type { LoadStatus } from './services'

export const useScheduleStore = defineStore('schedule', () => {
  const employees = ref<Employee[]>([])
  const services = ref<Service[]>([])
  const bookings = ref<Booking[]>([])
  const status = ref<LoadStatus>('idle')
  const error = ref<string | null>(null)
  let requestId = 0

  async function load(range: { from: DateKey; to: DateKey }) {
    const id = ++requestId
    status.value = 'loading'
    error.value = null
    try {
      const needsDictionaries = employees.value.length === 0
      const [list, emps, svcs] = await Promise.all([
        fetchAdminBookings(range),
        needsDictionaries ? fetchAdminEmployees() : Promise.resolve(employees.value),
        needsDictionaries ? fetchAdminServices() : Promise.resolve(services.value),
      ])
      if (id !== requestId) return
      bookings.value = list
      employees.value = emps
      services.value = svcs
      status.value = 'ready'
    } catch (e) {
      if (id !== requestId) return
      error.value = e instanceof Error ? e.message : 'Nieznany błąd.'
      status.value = 'error'
    }
  }

  async function changeStatus(bookingId: string, next: BookingStatus): Promise<Booking> {
    const updated = await updateBookingStatus(bookingId, next)
    bookings.value = bookings.value.map((b) => (b.id === updated.id ? updated : b))
    return updated
  }

  function invalidate() {
    employees.value = []
    services.value = []
  }

  return { employees, services, bookings, status, error, load, changeStatus, invalidate }
})
