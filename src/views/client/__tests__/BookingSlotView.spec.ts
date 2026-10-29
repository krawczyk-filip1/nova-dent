import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { updateDb } from '@/mocks/db'
import { clinicDateTime } from '@/lib/dates'
import { routes } from '@/router/routes'
import { useBookingFlowStore } from '@/stores/bookingFlow'
import App from '@/App.vue'

// Poniedziałek 2.11.2026, 11:58 w Warszawie. Nie równo 12:00, bo vi.waitFor przy fałszywym zegarze
// przesuwa go o 50 ms na każdą próbę - a już 12:00:00,05 + 1 h wyklucza termin 13:00.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(clinicDateTime('2026-11-02', '11:58'))
  setActivePinia(createPinia())
})
afterEach(() => vi.useRealTimers())

async function mountAt(path: string) {
  const pinia = createPinia()
  setActivePinia(pinia)
  const router = createRouter({ history: createMemoryHistory(), routes })
  await router.push(path)
  const wrapper = mount(App, { global: { plugins: [pinia, router] }, attachTo: document.body })
  return { wrapper, router, flow: useBookingFlowStore() }
}

async function waitForTimes(wrapper: VueWrapper) {
  await vi.waitFor(() =>
    expect(wrapper.find('[role="radiogroup"][aria-label^="Godzina"]').exists()).toBe(true),
  )
}

const timeButtons = (wrapper: VueWrapper) =>
  wrapper.findAll('[role="radiogroup"][aria-label^="Godzina"] [role="radio"]')

describe('BookingSlotView', () => {
  it('pokazuje usługę, lekarzy, dni i godziny pierwszego dnia z wolnymi terminami', async () => {
    const { wrapper } = await mountAt('/rezerwacja/termin?usluga=svc-higienizacja')
    await waitForTimes(wrapper)

    expect(wrapper.text()).toContain('Higienizacja')
    expect(wrapper.text()).toContain('hig. stom. Marta Zielińska')
    // Higienistka nie pracuje w poniedziałki - pierwszy dzień z terminami to wtorek 3.11.
    const checkedDay = wrapper.get('[aria-label="Dzień wizyty"] [aria-checked="true"]')
    expect(checkedDay.attributes('aria-label')).toContain('wtorek, 3 listopada')
    expect(timeButtons(wrapper)[0]!.text()).toBe('08:00')
    wrapper.unmount()
  })

  it('wybór godziny zapisuje termin w kreatorze i odblokowuje "Dalej"', async () => {
    const { wrapper, router, flow } = await mountAt('/rezerwacja/termin?usluga=svc-higienizacja')
    await waitForTimes(wrapper)
    expect(wrapper.text()).toContain('Wybierz dzień i godzinę wizyty.')

    await timeButtons(wrapper)[2]!.trigger('click') // 08:30

    expect(flow.slot).toEqual({
      start: '2026-11-03T07:30:00.000Z',
      end: '2026-11-03T08:30:00.000Z',
      employeeId: 'emp-zielinska',
    })
    expect(wrapper.text()).toContain(
      'Wybrano: wtorek, 3 listopada, 08:30 · hig. stom. Marta Zielińska',
    )

    const dalej = wrapper.findAll('button').find((b) => b.text() === 'Dalej: Twoje dane')!
    expect(dalej.attributes('disabled')).toBeUndefined()
    await dalej.trigger('click')
    await vi.waitFor(() => expect(router.currentRoute.value.name).toBe('booking-details'))
    wrapper.unmount()
  })

  it('zmiana lekarza pobiera jego terminy i czyści wybraną godzinę', async () => {
    const { wrapper, flow } = await mountAt('/rezerwacja/termin?usluga=svc-przeglad')
    await waitForTimes(wrapper)
    await timeButtons(wrapper)[0]!.trigger('click')
    expect(flow.slot).not.toBeNull()

    const piotr = wrapper
      .findAll('[aria-label="Lekarz"] [role="radio"]')
      .find((b) => b.text().includes('Wiśniewski'))!
    await piotr.trigger('click')

    expect(flow.employeeId).toBe('emp-wisniewski')
    expect(flow.slot).toBeNull()
    // Dziś 11:58 + 1 h; Wiśniewski w poniedziałki pracuje 10-18 -> pierwszy wolny 13:00.
    await vi.waitFor(() => expect(timeButtons(wrapper)[0]?.text()).toBe('13:00'))
    wrapper.unmount()
  })

  it('termin zapamiętany w sesji, a w międzyczasie zajęty, zostaje odznaczony z komunikatem', async () => {
    const start = clinicDateTime('2026-11-03', '09:00').toISOString()
    const end = clinicDateTime('2026-11-03', '10:00').toISOString()
    const flow = useBookingFlowStore()
    flow.selectService('svc-higienizacja')
    flow.selectSlot({ start, end, employeeId: 'emp-zielinska' })
    updateDb((db) => {
      db.bookings.push({
        id: 'b1',
        code: 'BK-TEST01',
        serviceId: 'svc-higienizacja',
        employeeId: 'emp-zielinska',
        start,
        end,
        status: 'confirmed',
        customer: { name: 'Ktoś', email: 'k@example.com', phone: '500600700' },
        createdAt: start,
        statusHistory: [],
      })
    })

    const { wrapper, flow: restored } = await mountAt('/rezerwacja/termin')
    await vi.waitFor(() => expect(wrapper.text()).toContain('został w międzyczasie zajęty'))
    expect(restored.slot).toBeNull()
    wrapper.unmount()
  })
})
