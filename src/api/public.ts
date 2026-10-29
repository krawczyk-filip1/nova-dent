import type { DateKey } from '@/lib/dates'
import type { CreateBookingRequest, PatientBooking } from '@/types/api'
import type { Booking, Employee, Service, TimeSlot } from '@/types/models'
import { api } from './client'

export function fetchServices() {
  return api.get<Service[]>('/api/services')
}

export function fetchEmployees(serviceId?: string) {
  return api.get<Employee[]>('/api/employees', { serviceId })
}

export interface AvailabilityQuery {
  serviceId: string
  employeeId: string | 'any'
  from: DateKey
  to: DateKey
}

export function fetchAvailability(query: AvailabilityQuery) {
  return api.get<TimeSlot[]>('/api/availability', { ...query })
}

export function createBooking(request: CreateBookingRequest) {
  return api.post<Booking>('/api/bookings', request)
}

/** 404 - ten sam dla złego kodu i złego e-maila (nie zdradzamy, które z nich się nie zgadza). */
export function lookupBooking(code: string, email: string) {
  return api.get<PatientBooking>('/api/bookings/lookup', { code, email })
}

export function cancelBooking(code: string, email: string) {
  return api.post<PatientBooking>(`/api/bookings/${encodeURIComponent(code)}/cancel`, { email })
}
