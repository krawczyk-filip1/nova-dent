import type { DateKey } from '@/lib/dates'
import type { BlockInput } from '@/schemas/block'
import type { ServiceInput } from '@/schemas/service'
import type { BlockSaveResponse, ScheduleSaveResponse, StatsResponse } from '@/types/api'
import type { Booking, BookingStatus, Employee, Service, TimeBlock } from '@/types/models'
import type { WeekSchedule } from '@/utils/schedule'
import { api } from './client'

const encode = encodeURIComponent

export function fetchAdminBookings(query: { from: DateKey; to: DateKey; employeeId?: string }) {
  return api.get<Booking[]>('/api/admin/bookings', query)
}

export function updateBookingStatus(id: string, status: BookingStatus) {
  return api.patch<Booking>(`/api/admin/bookings/${encode(id)}/status`, { status })
}

export function fetchAdminServices() {
  return api.get<Service[]>('/api/admin/services')
}

export function createService(input: ServiceInput) {
  return api.post<Service>('/api/admin/services', input)
}

export function updateService(id: string, input: ServiceInput) {
  return api.put<Service>(`/api/admin/services/${encode(id)}`, input)
}

export function deleteService(id: string) {
  return api.delete<null>(`/api/admin/services/${encode(id)}`)
}

export function fetchAdminEmployees() {
  return api.get<Employee[]>('/api/admin/employees')
}

export function updateEmployeeSchedule(id: string, schedule: WeekSchedule) {
  return api.put<ScheduleSaveResponse>(`/api/admin/employees/${encode(id)}/schedule`, { schedule })
}

export function fetchBlocks(query: { from: DateKey; to: DateKey }) {
  return api.get<TimeBlock[]>('/api/admin/blocks', query)
}

export function createBlock(input: BlockInput) {
  return api.post<BlockSaveResponse>('/api/admin/blocks', input)
}

export function deleteBlock(id: string) {
  return api.delete<null>(`/api/admin/blocks/${encode(id)}`)
}

export function fetchStats(query: { from: DateKey; to: DateKey }) {
  return api.get<StatsResponse>('/api/admin/stats', query)
}

export function resetDemo() {
  return api.post<null>('/api/admin/reset-demo')
}
