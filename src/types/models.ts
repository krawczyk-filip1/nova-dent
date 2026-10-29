// Model danych wspólny dla aplikacji i mock API.
// Daty i godziny jako ISO w UTC (np. "2026-10-29T07:15:00.000Z"); godziny pracy jako "08:00" czasu Warszawy.

export type BookingStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled'

export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6

export interface Service {
  id: string
  name: string
  description: string
  durationMin: number
  /** Cena w groszach - liczby całkowite, bez błędów zaokrągleń jak przy 0.1 + 0.2. */
  priceGrosze: number
  priceFrom: boolean
  active: boolean
}

export interface WorkingHours {
  start: string
  end: string
}

export interface Employee {
  id: string
  name: string
  title: string
  serviceIds: string[]
  schedule: Record<Weekday, WorkingHours | null>
}

export interface TimeBlock {
  id: string
  employeeId: string | null
  start: string
  end: string
  reason: 'vacation' | 'break' | 'other'
  note?: string
}

export interface Customer {
  name: string
  email: string
  phone: string
  notes?: string
}

export interface Booking {
  id: string
  code: string
  serviceId: string
  employeeId: string
  start: string
  end: string
  status: BookingStatus
  customer: Customer
  createdAt: string
  statusHistory: { status: BookingStatus; changedAt: string }[]
}

export interface TimeSlot {
  start: string
  end: string
  employeeIds: string[]
}
