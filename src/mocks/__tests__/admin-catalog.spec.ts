import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import {
  createBlock,
  createService,
  deleteBlock,
  deleteService,
  fetchBlocks,
  updateEmployeeSchedule,
  resetDemo,
  updateService,
} from '@/api/admin'
import { ApiError, configureApiAuth } from '@/api/client'
import { fetchAvailability, fetchEmployees, fetchServices } from '@/api/public'
import { clinicDateTime } from '@/lib/dates'
import { seedEmployees } from '@/mocks/seed'
import { addBooking, signInAsAdmin } from '@/test/fixtures'
import { readDb } from '../db'

const apiError = (status: number) => expect.objectContaining({ name: ApiError.name, status })

// Środa 4.11.2026, 11:58.
beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(clinicDateTime('2026-11-04', '11:58'))
  const { token } = await signInAsAdmin()
  configureApiAuth({ getToken: () => token, onUnauthorized: () => {} })
})
afterEach(() => vi.useRealTimers())

const newService = {
  name: 'Lakowanie bruzd',
  description: 'Zabezpieczenie zębów trzonowych.',
  durationMin: 30,
  priceGrosze: 120_00,
  priceFrom: false,
  active: true,
  employeeIds: ['emp-zielinska'],
}

describe('usługi', () => {
  it('nowa usługa: czytelne id, przypisanie osoby i od razu widoczna dla pacjentów', async () => {
    const created = await createService(newService)
    expect(created.id).toBe('svc-lakowanie-bruzd')
    expect((await fetchServices()).map((s) => s.id)).toContain(created.id)
    expect((await fetchEmployees(created.id)).map((e) => e.id)).toEqual(['emp-zielinska'])
  })

  it('wyłączenie usuwa usługę z oferty, a zmiana osób przepina przypisania', async () => {
    await updateService('svc-higienizacja', {
      ...newService,
      name: 'Higienizacja',
      active: false,
      employeeIds: ['emp-kowalska'],
    })
    expect((await fetchServices()).map((s) => s.id)).not.toContain('svc-higienizacja')
    const ids = readDb()
      .employees.filter((e) => e.serviceIds.includes('svc-higienizacja'))
      .map((e) => e.id)
    expect(ids).toEqual(['emp-kowalska'])
  })

  it('422 z błędami pól dla złych danych', async () => {
    const error = (await createService({ ...newService, name: 'X', employeeIds: [] }).catch(
      (e: unknown) => e,
    )) as ApiError
    expect(error.status).toBe(422)
    expect(error.body).toMatchObject({
      fieldErrors: { name: expect.any(String), employeeIds: expect.any(String) },
    })
  })

  it('usługi z wizytami nie da się usunąć (409), nową - tak, razem z przypisaniami', async () => {
    addBooking({ date: '2026-11-05', start: '09:00', end: '09:30', serviceId: 'svc-przeglad' })
    await expect(deleteService('svc-przeglad')).rejects.toEqual(apiError(409))

    const created = await createService(newService)
    await deleteService(created.id)
    expect(readDb().services.some((s) => s.id === created.id)).toBe(false)
    expect(readDb().employees.some((e) => e.serviceIds.includes(created.id))).toBe(false)
  })
})

describe('godziny pracy', () => {
  const kowalska = seedEmployees.find((e) => e.id === 'emp-kowalska')!

  it('zapis zmienia wolne terminy i zwraca wizyty, które wypadły poza nowe godziny', async () => {
    const outside = addBooking({
      date: '2026-11-05',
      start: '14:00',
      end: '14:30',
      name: 'Popołudniowy',
    })
    addBooking({ date: '2026-11-05', start: '09:00', end: '09:30', name: 'Poranny' })
    addBooking({
      date: '2026-10-29',
      start: '14:00',
      end: '14:30',
      status: 'completed',
      name: 'Miniony',
    })

    // Czwartki tylko 8-12.
    const result = await updateEmployeeSchedule('emp-kowalska', {
      ...kowalska.schedule,
      4: { start: '08:00', end: '12:00' },
    })

    expect(result.conflicts.map((b) => b.id)).toEqual([outside.id])
    const slots = await fetchAvailability({
      serviceId: 'svc-wypelnienie',
      employeeId: 'emp-kowalska',
      from: '2026-11-05',
      to: '2026-11-05',
    })
    expect(slots.at(-1)!.end).toBe(clinicDateTime('2026-11-05', '12:00').toISOString())
  })

  it('422 dla niepoprawnych godzin', async () => {
    await expect(
      updateEmployeeSchedule('emp-kowalska', {
        ...kowalska.schedule,
        1: { start: '15:00', end: '09:00' },
      }),
    ).rejects.toEqual(apiError(422))
  })
})

describe('blokady', () => {
  it('blokada gabinetu zabiera terminy wszystkim i zwraca kolidujące wizyty', async () => {
    const clash = addBooking({ date: '2026-11-11', start: '10:00', end: '10:30', name: 'W święto' })
    const { block, conflicts } = await createBlock({
      employeeId: null,
      start: clinicDateTime('2026-11-11', '00:00').toISOString(),
      end: clinicDateTime('2026-11-12', '00:00').toISOString(),
      reason: 'other',
      note: 'Święto Niepodległości',
    })
    expect(conflicts.map((b) => b.id)).toEqual([clash.id])

    const slots = await fetchAvailability({
      serviceId: 'svc-przeglad',
      employeeId: 'any',
      from: '2026-11-11',
      to: '2026-11-11',
    })
    expect(slots).toEqual([])
    expect((await fetchBlocks({ from: '2026-11-01', to: '2026-11-30' })).map((b) => b.id)).toEqual([
      block.id,
    ])

    await deleteBlock(block.id)
    const after = await fetchAvailability({
      serviceId: 'svc-przeglad',
      employeeId: 'any',
      from: '2026-11-11',
      to: '2026-11-11',
    })
    expect(after.length).toBeGreaterThan(0)
  })

  it('422, gdy koniec jest przed początkiem', async () => {
    await expect(
      createBlock({
        employeeId: 'emp-kowalska',
        start: clinicDateTime('2026-11-11', '12:00').toISOString(),
        end: clinicDateTime('2026-11-11', '11:00').toISOString(),
        reason: 'break',
      }),
    ).rejects.toEqual(apiError(422))
  })

  it('bez logowania - 401', async () => {
    configureApiAuth({ getToken: () => null, onUnauthorized: () => {} })
    await expect(fetchBlocks({ from: '2026-11-01', to: '2026-11-30' })).rejects.toEqual(
      apiError(401),
    )
  })
})

describe('przywracanie danych demo', () => {
  it('cofa zmiany w usługach, grafikach, blokadach i rezerwacjach', async () => {
    await createService(newService)
    await createBlock({
      employeeId: null,
      start: clinicDateTime('2026-11-11', '00:00').toISOString(),
      end: clinicDateTime('2026-11-12', '00:00').toISOString(),
      reason: 'other',
    })
    addBooking({ date: '2026-11-05', start: '09:00', end: '09:30' })

    await resetDemo()

    const db = readDb()
    expect(db.services.map((s) => s.id)).not.toContain('svc-lakowanie-bruzd')
    expect(db.blocks).toEqual([])
    expect(db.bookings).toEqual([]) // w testach baza startuje bez rezerwacji demo
  })
})
