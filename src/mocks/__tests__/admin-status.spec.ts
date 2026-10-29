import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import { updateBookingStatus } from '@/api/admin'
import { ApiError, configureApiAuth } from '@/api/client'
import { clinicDateTime } from '@/lib/dates'
import { addBooking, signInAsAdmin } from '@/test/fixtures'
import { readDb } from '../db'

const apiError = (status: number) => expect.objectContaining({ name: ApiError.name, status })

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(clinicDateTime('2026-11-04', '11:58'))
  const { token } = await signInAsAdmin()
  configureApiAuth({ getToken: () => token, onUnauthorized: () => {} })
})
afterEach(() => vi.useRealTimers())

describe('PATCH /api/admin/bookings/:id/status', () => {
  it('potwierdza oczekującą i dopisuje historię', async () => {
    const b = addBooking({ date: '2026-11-05', start: '09:00', end: '09:30' })
    const updated = await updateBookingStatus(b.id, 'confirmed')
    expect(updated.status).toBe('confirmed')
    expect(updated.statusHistory.map((h) => h.status)).toEqual(['pending', 'confirmed'])
    expect(readDb().bookings[0]!.status).toBe('confirmed')
  })

  it('422 dla niedozwolonego przejścia (odwołana -> potwierdzona)', async () => {
    const b = addBooking({ date: '2026-11-05', start: '09:00', end: '09:30', status: 'cancelled' })
    await expect(updateBookingStatus(b.id, 'confirmed')).rejects.toEqual(apiError(422))
  })

  it('422 przy próbie zakończenia wizyty, która się jeszcze nie zaczęła', async () => {
    const future = addBooking({
      date: '2026-11-05',
      start: '09:00',
      end: '09:30',
      status: 'confirmed',
    })
    await expect(updateBookingStatus(future.id, 'completed')).rejects.toEqual(apiError(422))

    const started = addBooking({
      date: '2026-11-04',
      start: '11:30',
      end: '12:30',
      status: 'confirmed',
    })
    await expect(updateBookingStatus(started.id, 'completed')).resolves.toMatchObject({
      status: 'completed',
    })
  })

  it('404 dla nieznanej rezerwacji, 401 bez logowania', async () => {
    await expect(updateBookingStatus('nie-ma', 'confirmed')).rejects.toEqual(apiError(404))
    configureApiAuth({ getToken: () => null, onUnauthorized: () => {} })
    const b = addBooking({ date: '2026-11-05', start: '09:00', end: '09:30' })
    await expect(updateBookingStatus(b.id, 'confirmed')).rejects.toEqual(apiError(401))
  })
})
