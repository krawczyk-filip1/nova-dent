import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import { ApiError } from '@/api/client'
import { cancelBooking, createBooking, fetchAvailability, lookupBooking } from '@/api/public'
import { clinicDateTime } from '@/lib/dates'
import type { Booking } from '@/types/models'
import { readDb } from '../db'

// Poniedziałek 2.11.2026, 11:58. Wizyta we wtorek 3.11 o 13:00 - ponad 24 h później.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(clinicDateTime('2026-11-02', '11:58'))
})
afterEach(() => vi.useRealTimers())

const apiError = (status: number) => expect.objectContaining({ name: ApiError.name, status })

function book(): Promise<Booking> {
  return createBooking({
    serviceId: 'svc-higienizacja',
    employeeId: 'emp-zielinska',
    start: clinicDateTime('2026-11-03', '13:00').toISOString(),
    customer: { name: 'Jan Kowalski', email: 'jan@example.com', phone: '600700800' },
  })
}

describe('GET /api/bookings/lookup', () => {
  it('zwraca rezerwację z nazwami usługi i lekarza oraz informacją o odwołaniu', async () => {
    const { code } = await book()
    const result = await lookupBooking(code, 'jan@example.com')
    expect(result).toMatchObject({
      booking: { code, status: 'pending' },
      serviceName: 'Higienizacja',
      employeeName: 'hig. stom. Marta Zielińska',
      canCancel: true,
      cancelDeadline: clinicDateTime('2026-11-02', '13:00').toISOString(),
    })
  })

  it('kod i e-mail bez względu na wielkość liter i odstępy', async () => {
    const { code } = await book()
    const messy = ' ' + code.toLowerCase().replace('-', ' ') + ' '
    await expect(lookupBooking(messy, ' JAN@example.COM ')).resolves.toBeTruthy()
  })

  it('ten sam błąd 404 dla złego kodu i dla złego e-maila', async () => {
    const { code } = await book()
    const wrongCode = await lookupBooking('BK-ZZZZZZ', 'jan@example.com').catch((e: ApiError) => e)
    const wrongEmail = await lookupBooking(code, 'ktos@example.com').catch((e: ApiError) => e)
    expect(wrongCode).toEqual(apiError(404))
    expect(wrongEmail).toEqual(apiError(404))
    expect((wrongCode as ApiError).message).toBe((wrongEmail as ApiError).message)
  })
})

describe('POST /api/bookings/:code/cancel', () => {
  it('odwołuje wizytę, zapisuje historię i zwalnia termin', async () => {
    const { code } = await book()

    const result = await cancelBooking(code, 'jan@example.com')

    expect(result.booking.status).toBe('cancelled')
    expect(result.canCancel).toBe(false)
    expect(readDb().bookings[0]!.statusHistory.map((h) => h.status)).toEqual([
      'pending',
      'cancelled',
    ])
    const slots = await fetchAvailability({
      serviceId: 'svc-higienizacja',
      employeeId: 'any',
      from: '2026-11-03',
      to: '2026-11-03',
    })
    expect(slots.map((s) => s.start)).toContain(clinicDateTime('2026-11-03', '13:00').toISOString())
  })

  it('409 przy drugim odwołaniu', async () => {
    const { code } = await book()
    await cancelBooking(code, 'jan@example.com')
    await expect(cancelBooking(code, 'jan@example.com')).rejects.toEqual(apiError(409))
  })

  it('409 z numerem telefonu, gdy do wizyty zostało mniej niż 24 h', async () => {
    const { code } = await book()
    vi.setSystemTime(clinicDateTime('2026-11-02', '13:01'))

    const error = (await cancelBooking(code, 'jan@example.com').catch(
      (e: unknown) => e,
    )) as ApiError
    expect(error.status).toBe(409)
    expect(error.message).toContain('telefonicznie')
    expect(readDb().bookings[0]!.status).toBe('pending')
  })

  it('404 przy złym e-mailu - nie da się odwołać cudzej wizyty', async () => {
    const { code } = await book()
    await expect(cancelBooking(code, 'ktos@example.com')).rejects.toEqual(apiError(404))
    expect(readDb().bookings[0]!.status).toBe('pending')
  })
})
