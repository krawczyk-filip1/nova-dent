import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import type { VueWrapper } from '@vue/test-utils'
import { http, HttpResponse } from 'msw'
import { clinicDateTime } from '@/lib/dates'
import { readDb } from '@/mocks/db'
import { mountApp } from '@/test/app'
import { addBooking, signInAsAdmin } from '@/test/fixtures'
import { server } from '@/test/server'

// Środa 4.11.2026, 11:58. W środy pracują Kowalska (8-16) i Wiśniewski (10-18); Zielińska nie.
const TODAY = '2026-11-04'

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(clinicDateTime(TODAY, '11:58'))
  await signInAsAdmin()
})
afterEach(() => vi.useRealTimers())

async function openSchedule(query = '') {
  const app = await mountApp(`/admin/grafik${query}`)
  // Podsumowanie "N wizyt..." pojawia się dopiero po załadowaniu danych (legenda jest od razu).
  await vi.waitFor(() => expect(app.wrapper.text()).toMatch(/\d+ wizyt/))
  return app
}

const bookingButton = (wrapper: VueWrapper, name: string) =>
  wrapper.findAll('section button').find((b) => b.attributes('aria-label')?.includes(name))
const button = (wrapper: VueWrapper, text: string) =>
  wrapper.findAll('button').find((b) => b.text() === text)

describe('AdminScheduleView - dzień', () => {
  it('kolumny osób pracujących tego dnia i wizyty z pełnym opisem', async () => {
    addBooking({ date: TODAY, start: '14:00', end: '14:30', name: 'Jan Oczekujący' })
    addBooking({ date: '2026-11-05', start: '14:00', end: '14:30', name: 'Inny Dzień' })
    const { wrapper } = await openSchedule()

    const columns = wrapper.findAll('section[aria-label]').map((s) => s.attributes('aria-label'))
    expect(columns).toEqual(['Anna Kowalska, lek. dent.', 'Piotr Wiśniewski, lek. dent.'])
    expect(bookingButton(wrapper, 'Jan Oczekujący')!.attributes('aria-label')).toBe(
      '14:00–14:30, Przegląd i konsultacja, Jan Oczekujący, lek. dent. Anna Kowalska, Czeka na potwierdzenie gabinetu',
    )
    expect(bookingButton(wrapper, 'Inny Dzień')).toBeUndefined()
    expect(wrapper.text()).toContain('1 wizyta, w tym 1 czeka na potwierdzenie')
    wrapper.unmount()
  })

  it('odwołane są ukryte, dopóki nie zaznaczy się "Pokaż odwołane"', async () => {
    addBooking({
      date: TODAY,
      start: '15:00',
      end: '15:30',
      status: 'cancelled',
      name: 'Ola Odwołana',
    })
    const { wrapper } = await openSchedule()
    expect(bookingButton(wrapper, 'Ola Odwołana')).toBeUndefined()

    await wrapper.get('input[type="checkbox"]').setValue(true)
    expect(bookingButton(wrapper, 'Ola Odwołana')).toBeDefined()
    wrapper.unmount()
  })

  it('strzałki i "Dziś" zmieniają datę w adresie', async () => {
    const { wrapper, router } = await openSchedule()
    await wrapper.get('button[aria-label="Następny dzień"]').trigger('click')
    await vi.waitFor(() => expect(router.currentRoute.value.query.data).toBe('2026-11-05'))
    await button(wrapper, 'Dziś')!.trigger('click')
    await vi.waitFor(() => expect(router.currentRoute.value.query.data).toBe(TODAY))
    wrapper.unmount()
  })
})

describe('AdminScheduleView - zmiana statusu', () => {
  it('potwierdzenie oczekującej: okno, zapis, zamknięcie i komunikat', async () => {
    const b = addBooking({ date: TODAY, start: '14:00', end: '14:30', name: 'Jan Oczekujący' })
    const { wrapper } = await openSchedule()

    await bookingButton(wrapper, 'Jan Oczekujący')!.trigger('click')
    const dialog = wrapper.get('dialog[open]')
    expect(dialog.attributes('open')).toBeDefined()
    expect(dialog.text()).toContain('jan@example.com')

    await button(wrapper, 'Potwierdź')!.trigger('click')

    await vi.waitFor(() => expect(wrapper.find('dialog[open]').exists()).toBe(false))
    expect(readDb().bookings.find((x) => x.id === b.id)!.status).toBe('confirmed')
    expect(wrapper.get('[role="status"]').text()).toBe('Jan Oczekujący: potwierdzona.')
    expect(bookingButton(wrapper, 'Jan Oczekujący')!.attributes('aria-label')).toContain(
      'Potwierdzona',
    )
    wrapper.unmount()
  })

  it('odwołanie wymaga drugiego kliknięcia', async () => {
    const b = addBooking({ date: TODAY, start: '14:00', end: '14:30', name: 'Jan Oczekujący' })
    const { wrapper } = await openSchedule()
    await bookingButton(wrapper, 'Jan Oczekujący')!.trigger('click')

    await button(wrapper, 'Odwołaj wizytę')!.trigger('click')
    expect(wrapper.get('dialog[open]').text()).toContain('Na pewno odwołać?')
    expect(readDb().bookings[0]!.status).toBe('pending')

    await button(wrapper, 'Tak, odwołaj')!.trigger('click')
    await vi.waitFor(() =>
      expect(readDb().bookings.find((x) => x.id === b.id)!.status).toBe('cancelled'),
    )
    wrapper.unmount()
  })

  it('"zakończ" tylko dla wizyty, która już się zaczęła', async () => {
    addBooking({
      date: TODAY,
      start: '15:00',
      end: '15:30',
      status: 'confirmed',
      name: 'Przyszła Wizyta',
    })
    addBooking({
      date: TODAY,
      start: '11:00',
      end: '12:00',
      status: 'confirmed',
      employeeId: 'emp-wisniewski',
      name: 'Trwająca Wizyta',
    })
    const { wrapper } = await openSchedule()

    await bookingButton(wrapper, 'Przyszła Wizyta')!.trigger('click')
    expect(button(wrapper, 'Oznacz jako zakończoną')).toBeUndefined()
    expect(wrapper.get('dialog[open]').text()).toContain('dopiero od jej rozpoczęcia')

    await wrapper.findAll('button[aria-label="Zamknij"]')[0]!.trigger('click')
    await bookingButton(wrapper, 'Trwająca Wizyta')!.trigger('click')
    expect(button(wrapper, 'Oznacz jako zakończoną')).toBeDefined()
    wrapper.unmount()
  })

  it('błąd serwera zostaje w oknie, a status się nie zmienia', async () => {
    server.use(
      http.patch('/api/admin/bookings/:id/status', () =>
        HttpResponse.json({ message: 'Nie można zmienić statusu.' }, { status: 422 }),
      ),
    )
    addBooking({ date: TODAY, start: '14:00', end: '14:30', name: 'Jan Oczekujący' })
    const { wrapper } = await openSchedule()
    await bookingButton(wrapper, 'Jan Oczekujący')!.trigger('click')
    await button(wrapper, 'Potwierdź')!.trigger('click')

    await vi.waitFor(() =>
      expect(wrapper.get('dialog[open] [role="alert"]').text()).toBe('Nie można zmienić statusu.'),
    )
    expect(wrapper.find('dialog[open]').exists()).toBe(true)
    expect(readDb().bookings[0]!.status).toBe('pending')
    wrapper.unmount()
  })
})

describe('AdminScheduleView - tydzień', () => {
  it('7 kolumn od poniedziałku, wizyty z całego tygodnia, filtr osoby', async () => {
    addBooking({ date: '2026-11-02', start: '10:00', end: '10:30', name: 'Poniedziałkowy Pacjent' })
    addBooking({
      date: '2026-11-07',
      start: '10:00',
      end: '11:00',
      employeeId: 'emp-zielinska',
      serviceId: 'svc-higienizacja',
      name: 'Sobotni Pacjent',
    })
    const { wrapper, router } = await openSchedule('?widok=tydzien')

    const columns = wrapper.findAll('section[aria-label]').map((s) => s.attributes('aria-label'))
    expect(columns).toHaveLength(7)
    expect(columns[0]).toBe('poniedziałek, 2 listopada')
    expect(columns[6]).toBe('niedziela, 8 listopada')
    expect(bookingButton(wrapper, 'Poniedziałkowy Pacjent')).toBeDefined()
    expect(bookingButton(wrapper, 'Sobotni Pacjent')).toBeDefined()

    await wrapper.get('select').setValue('emp-zielinska')
    expect(bookingButton(wrapper, 'Poniedziałkowy Pacjent')).toBeUndefined()
    expect(bookingButton(wrapper, 'Sobotni Pacjent')).toBeDefined()

    await wrapper.get('button[aria-label="Następny tydzień"]').trigger('click')
    await vi.waitFor(() => expect(router.currentRoute.value.query.data).toBe('2026-11-11'))
    wrapper.unmount()
  })
})
