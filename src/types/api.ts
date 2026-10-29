import type { CustomerInput } from '@/schemas/customer'
import type { PeriodStats } from '@/utils/stats'
import type { Booking, Employee, TimeBlock } from './models'

export interface CreateBookingRequest {
  serviceId: string
  employeeId: string
  start: string
  customer: CustomerInput
}

export interface PatientBooking {
  booking: Booking
  serviceName: string
  employeeName: string
  canCancel: boolean
  cancelDeadline: string
}

export interface LoginRequest {
  username: string
  password: string
}

export interface LoginResponse {
  token: string
  expiresAt: string
  name: string
}

/**
 * Zmiana grafiku lub nowa blokada zapisuje się zawsze, ale serwer zwraca przyszłe aktywne wizyty,
 * które przestały pasować - recepcja musi je przełożyć albo odwołać.
 */
export interface ScheduleSaveResponse {
  employee: Employee
  conflicts: Booking[]
}

export interface BlockSaveResponse {
  block: TimeBlock
  conflicts: Booking[]
}

export interface StatsResponse {
  current: PeriodStats
  previous: PeriodStats
}

export interface ValidationErrorBody {
  message: string
  fieldErrors?: Record<string, string>
}
