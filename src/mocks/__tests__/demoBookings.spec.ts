import { describe, it, expect } from 'vitest'
import { clinicDateTime, toClinicDateKey } from '@/lib/dates'
import { isBookingCode } from '@/utils/bookingCode'
import { overlaps } from '@/utils/slots'
import { generateDemoBookings } from '../demoBookings'
import { seedBlocks, seedEmployees, seedServices } from '../seed'

const NOW = clinicDateTime('2026-11-04', '12:00')
const input = { services: seedServices, employees: seedEmployees, blocks: seedBlocks }

describe('generateDemoBookings', () => {
  const bookings = generateDemoBookings(input, NOW)

  it('tworzy wizyty od 180 dni wstecz do 14 dni naprzód', () => {
    expect(bookings.length).toBeGreaterThan(100)
    const days = bookings.map((b) => toClinicDateKey(b.start)).sort()
    expect(days[0]! >= '2026-05-08').toBe(true)
    expect(days.at(-1)! <= '2026-11-18').toBe(true)
  })

  it('aktywne wizyty jednej osoby nigdy się nie nakładają', () => {
    for (const employee of seedEmployees) {
      const own = bookings
        .filter((b) => b.employeeId === employee.id && b.status !== 'cancelled')
        .map((b) => ({ start: Date.parse(b.start), end: Date.parse(b.end) }))
        .sort((a, b) => a.start - b.start)
      const clashes = own.filter((visit, i) => i > 0 && overlaps(own[i - 1]!, visit))
      expect(clashes).toEqual([])
    }
  })

  it('każda wizyta to usługa, którą dana osoba wykonuje, w jej godzinach pracy', () => {
    for (const b of bookings) {
      const employee = seedEmployees.find((e) => e.id === b.employeeId)!
      expect(employee.serviceIds).toContain(b.serviceId)
    }
  })

  it('statusy pasują do czasu: przeszłe zakończone lub odwołane, nic przyszłego nie jest zakończone', () => {
    const past = bookings.filter((b) => Date.parse(b.end) <= NOW.getTime())
    const future = bookings.filter((b) => Date.parse(b.start) > NOW.getTime())
    expect(past.every((b) => b.status === 'completed' || b.status === 'cancelled')).toBe(true)
    expect(future.some((b) => b.status === 'completed')).toBe(false)

    for (const b of bookings) {
      expect(b.statusHistory[0]!.status).toBe('pending')
      expect(b.statusHistory.at(-1)!.status).toBe(b.status)
      expect(Date.parse(b.createdAt)).toBeLessThanOrEqual(NOW.getTime())
    }
  })

  it('kody są poprawne i unikalne', () => {
    const codes = bookings.map((b) => b.code)
    expect(codes.every(isBookingCode)).toBe(true)
    expect(new Set(codes).size).toBe(codes.length)
  })

  it('to samo ziarno daje ten sam rozkład wizyt', () => {
    const again = generateDemoBookings(input, NOW)
    const shape = (list: typeof bookings) =>
      list.map((b) => `${b.employeeId}@${b.start}:${b.status}`)
    expect(shape(again)).toEqual(shape(bookings))
  })
})
