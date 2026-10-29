import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import type { VueWrapper } from '@vue/test-utils'
import { clinicDateTime } from '@/lib/dates'
import { useBookingFlowStore } from '@/stores/bookingFlow'
import { mountApp } from '@/test/app'

// Środa 4.11.2026, 11:58.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(clinicDateTime('2026-11-04', '11:58'))
})
afterEach(() => vi.useRealTimers())

const widget = (wrapper: VueWrapper) => wrapper.get('[aria-labelledby="szybka-rezerwacja"]')
const slotButtons = (wrapper: VueWrapper) => widget(wrapper).findAll('ul button')
const select = (wrapper: VueWrapper, label: string) => {
  const id = widget(wrapper)
    .findAll('label')
    .find((l) => l.text() === label)!
    .attributes('for')
  return widget(wrapper).get(`#${id}`)
}

describe('QuickBookingWidget (strona główna)', () => {
  it('pokazuje 4 najbliższe terminy pierwszej usługi i prowadzi prosto do "Twoje dane"', async () => {
    const { wrapper, router } = await mountApp('/')
    await vi.waitFor(() => expect(slotButtons(wrapper)).toHaveLength(4))

    // Przegląd (30 min): dziś od 13:00 (11:58 + 1 h, siatka co 15 min).
    expect(slotButtons(wrapper)[0]!.text()).toBe('Dziś13:00')
    await slotButtons(wrapper)[0]!.trigger('click')

    await vi.waitFor(() => expect(router.currentRoute.value.name).toBe('booking-details'))
    const flow = useBookingFlowStore()
    expect(flow.serviceId).toBe('svc-przeglad')
    expect(flow.slot?.start).toBe(clinicDateTime('2026-11-04', '13:00').toISOString())
    wrapper.unmount()
  })

  it('zmiana usługi i lekarza zmienia listę terminów', async () => {
    const { wrapper } = await mountApp('/')
    await vi.waitFor(() => expect(slotButtons(wrapper)).toHaveLength(4))

    await select(wrapper, 'Usługa').setValue('svc-higienizacja')
    // Higienistka w środy nie pracuje - pierwszy termin to czwartek 8:00.
    await vi.waitFor(() => expect(slotButtons(wrapper)[0]?.text()).toBe('Jutro08:00'))
    expect(widget(wrapper).text()).toContain('hig. stom. Marta Zielińska')
    wrapper.unmount()
  })
})
