import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import { fetchAvailability } from '@/api/public'
import { ApiError } from '@/api/client'
import { clinicDateTime, formatClinicTime } from '@/lib/dates'
import { updateDb } from '../db'

// Poniedziałek 2.11.2026, 12:00 w Warszawie. Fałszujemy tylko Date - timery MSW działają normalnie.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(clinicDateTime('2026-11-02', '12:00'))
})
afterEach(() => vi.useRealTimers())

const TUESDAY = '2026-11-03'
const WEDNESDAY = '2026-11-04'

const apiError = (status: number) => expect.objectContaining({ name: ApiError.name, status })

describe('GET /api/availability', () => {
  it('liczy terminy z grafiku osoby (higienistka, wtorek 8-16, usługa 60 min)', async () => {
    const slots = await fetchAvailability({
      serviceId: 'svc-higienizacja',
      employeeId: 'any',
      from: TUESDAY,
      to: TUESDAY,
    })
    expect(slots).toHaveLength(29)
    expect(formatClinicTime(slots[0]!.start)).toBe('08:00')
    expect(formatClinicTime(slots.at(-1)!.start)).toBe('15:00')
    expect(slots.every((s) => s.employeeIds.join() === 'emp-zielinska')).toBe(true)
  })

  it('uwzględnia rezerwacje zapisane w bazie', async () => {
    updateDb((db) => {
      db.bookings.push({
        id: 'b1',
        code: 'BK-TEST01',
        serviceId: 'svc-higienizacja',
        employeeId: 'emp-zielinska',
        start: clinicDateTime(TUESDAY, '09:00').toISOString(),
        end: clinicDateTime(TUESDAY, '10:00').toISOString(),
        status: 'pending',
        customer: { name: 'Jan Test', email: 'jan@example.com', phone: '500600700' },
        createdAt: new Date().toISOString(),
        statusHistory: [{ status: 'pending', changedAt: new Date().toISOString() }],
      })
    })
    const slots = await fetchAvailability({
      serviceId: 'svc-higienizacja',
      employeeId: 'any',
      from: TUESDAY,
      to: TUESDAY,
    })
    const times = slots.map((s) => formatClinicTime(s.start))
    expect(times).not.toContain('09:00')
    expect(times).toContain('10:00')
  })

  it('"dowolny dostępny" łączy lekarzy, a wybór konkretnej osoby zawęża wynik', async () => {
    const query = { serviceId: 'svc-przeglad', from: WEDNESDAY, to: WEDNESDAY }
    const any = await fetchAvailability({ ...query, employeeId: 'any' })
    const at10 = any.find((s) => formatClinicTime(s.start) === '10:00')
    expect(at10?.employeeIds).toEqual(['emp-kowalska', 'emp-wisniewski'])

    const piotr = await fetchAvailability({ ...query, employeeId: 'emp-wisniewski' })
    expect(formatClinicTime(piotr[0]!.start)).toBe('10:00')
    expect(piotr.every((s) => s.employeeIds.join() === 'emp-wisniewski')).toBe(true)
  })

  it('obejmuje kilka dni i pomija dzisiejsze godziny bez wyprzedzenia', async () => {
    const slots = await fetchAvailability({
      serviceId: 'svc-przeglad',
      employeeId: 'emp-kowalska',
      from: '2026-11-02',
      to: TUESDAY,
    })
    // Dziś 12:00 + 1 h -> pierwszy dzisiejszy termin o 13:00.
    expect(formatClinicTime(slots[0]!.start)).toBe('13:00')
    expect(slots.some((s) => s.start.startsWith(TUESDAY))).toBe(true)
  })

  it('422 przy złym lub zbyt długim zakresie dat', async () => {
    const base = { serviceId: 'svc-przeglad', employeeId: 'any' }
    await expect(
      fetchAvailability({ ...base, from: '2026-11-05', to: '2026-11-04' }),
    ).rejects.toEqual(apiError(422))
    await expect(
      fetchAvailability({ ...base, from: '2026-02-30', to: '2026-03-01' }),
    ).rejects.toEqual(apiError(422))
    await expect(
      fetchAvailability({ ...base, from: '2026-11-01', to: '2027-01-15' }),
    ).rejects.toEqual(apiError(422))
  })

  it('404 dla nieznanej lub nieaktywnej usługi i dla osoby, która jej nie wykonuje', async () => {
    const range = { from: TUESDAY, to: TUESDAY }
    await expect(
      fetchAvailability({ ...range, serviceId: 'svc-x', employeeId: 'any' }),
    ).rejects.toEqual(apiError(404))
    await expect(
      fetchAvailability({ ...range, serviceId: 'svc-fluoryzacja', employeeId: 'any' }),
    ).rejects.toEqual(apiError(404))
    await expect(
      fetchAvailability({ ...range, serviceId: 'svc-higienizacja', employeeId: 'emp-kowalska' }),
    ).rejects.toEqual(apiError(404))
  })
})
