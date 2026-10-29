import { login } from '@/api/auth'
import { clinicDateTime, type DateKey } from '@/lib/dates'
import { updateDb } from '@/mocks/db'
import { AUTH_STORAGE_KEY } from '@/stores/auth'
import type { Booking, BookingStatus } from '@/types/models'

export async function signInAsAdmin() {
  const session = await login({ username: 'admin', password: 'admin' })
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session))
  return session
}

let counter = 0

export function addBooking(options: {
  date: DateKey
  start: string
  end: string
  employeeId?: string
  serviceId?: string
  status?: BookingStatus
  name?: string
}): Booking {
  counter += 1
  const start = clinicDateTime(options.date, options.start).toISOString()
  const booking: Booking = {
    id: `test-${counter}`,
    code: `BK-TEST${String(counter).padStart(2, '0').replace(/0/g, 'A').replace(/1/g, 'B')}`,
    serviceId: options.serviceId ?? 'svc-przeglad',
    employeeId: options.employeeId ?? 'emp-kowalska',
    start,
    end: clinicDateTime(options.date, options.end).toISOString(),
    status: options.status ?? 'pending',
    customer: { name: options.name ?? 'Jan Test', email: 'jan@example.com', phone: '600700800' },
    createdAt: start,
    statusHistory: [{ status: 'pending', changedAt: start }],
  }
  updateDb((db) => void db.bookings.push(booking))
  return booking
}
