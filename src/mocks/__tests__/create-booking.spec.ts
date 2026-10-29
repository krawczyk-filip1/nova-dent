import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import { ApiError } from '@/api/client'
import { createBooking, fetchAvailability } from '@/api/public'
import { clinicDateTime } from '@/lib/dates'
import type { CreateBookingRequest } from '@/types/api'
import { isBookingCode } from '@/utils/bookingCode'
import { readDb } from '../db'

// Poniedziałek 2.11.2026, 11:58 w Warszawie.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(clinicDateTime('2026-11-02', '11:58'))
})
afterEach(() => vi.useRealTimers())

const request = (overrides: Partial<CreateBookingRequest> = {}): CreateBookingRequest => ({
  serviceId: 'svc-higienizacja',
  employeeId: 'emp-zielinska',
  start: clinicDateTime('2026-11-03', '09:00').toISOString(),
  customer: { name: 'Jan Kowalski', email: 'Jan@Example.com', phone: '600 700 800' },
  ...overrides,
})

const apiError = (status: number) => expect.objectContaining({ name: ApiError.name, status })

describe('POST /api/bookings', () => {
  it('zapisuje rezerwację jako oczekującą, z kodem, końcem z czasu usługi i znormalizowanymi danymi', async () => {
    const booking = await createBooking(request())

    expect(isBookingCode(booking.code)).toBe(true)
    expect(booking).toMatchObject({
      status: 'pending',
      start: '2026-11-03T08:00:00.000Z',
      end: '2026-11-03T09:00:00.000Z', // higienizacja trwa 60 min
      customer: { email: 'jan@example.com', phone: '600700800' },
    })
    expect(booking.statusHistory).toEqual([{ status: 'pending', changedAt: booking.createdAt }])
    expect(readDb().bookings.map((b) => b.code)).toEqual([booking.code])
  })

  it('zapisany termin znika z listy wolnych', async () => {
    await createBooking(request())
    const slots = await fetchAvailability({
      serviceId: 'svc-higienizacja',
      employeeId: 'any',
      from: '2026-11-03',
      to: '2026-11-03',
    })
    expect(slots.map((s) => s.start)).not.toContain('2026-11-03T08:00:00.000Z')
  })

  it('409, gdy ktoś zajął ten termin chwilę wcześniej', async () => {
    await createBooking(request())
    await expect(createBooking(request())).rejects.toEqual(apiError(409))
    expect(readDb().bookings).toHaveLength(1)
  })

  it('409 dla terminu, który nie jest w grafiku (np. poza godzinami pracy)', async () => {
    const start = clinicDateTime('2026-11-03', '19:00').toISOString()
    await expect(createBooking(request({ start }))).rejects.toEqual(apiError(409))
  })

  it('422 z błędami pól dla złych danych pacjenta', async () => {
    const error = (await createBooking(
      request({ customer: { name: 'Jan', email: 'zly', phone: '123' } }),
    ).catch((e: unknown) => e)) as ApiError

    expect(error.status).toBe(422)
    expect(error.body).toMatchObject({
      fieldErrors: {
        name: expect.stringContaining('imię i nazwisko'),
        email: expect.any(String),
        phone: expect.stringContaining('9 cyfr'),
      },
    })
    expect(readDb().bookings).toHaveLength(0)
  })

  it('422, gdy osoba nie wykonuje usługi albo usługa jest nieaktywna', async () => {
    await expect(createBooking(request({ employeeId: 'emp-kowalska' }))).rejects.toEqual(
      apiError(422),
    )
    await expect(createBooking(request({ serviceId: 'svc-fluoryzacja' }))).rejects.toEqual(
      apiError(422),
    )
  })
})
