import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/server'
import { readDb } from '@/mocks/db'
import { clinicDateTime } from '@/lib/dates'
import { routes } from '@/router/routes'
import { useBookingFlowStore } from '@/stores/bookingFlow'
import App from '@/App.vue'

// Poniedziałek 2.11.2026, 11:58 w Warszawie (zob. komentarz w BookingSlotView.spec.ts).
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(clinicDateTime('2026-11-02', '11:58'))
  setActivePinia(createPinia())
})
afterEach(() => vi.useRealTimers())

const SLOT = {
  start: clinicDateTime('2026-11-03', '09:00').toISOString(),
  end: clinicDateTime('2026-11-03', '10:00').toISOString(),
  employeeId: 'emp-zielinska',
}
const CUSTOMER = { name: 'Jan Kowalski', email: 'jan@example.com', phone: '600700800' }

async function mountAt(path: string, { withCustomer = false } = {}) {
  const pinia = createPinia()
  setActivePinia(pinia)
  const flow = useBookingFlowStore()
  flow.selectService('svc-higienizacja')
  flow.selectSlot(SLOT)
  if (withCustomer) flow.setCustomer(CUSTOMER)

  const router = createRouter({ history: createMemoryHistory(), routes })
  await router.push(path)
  const wrapper = mount(App, { global: { plugins: [pinia, router] }, attachTo: document.body })
  await vi.waitFor(() => expect(wrapper.find('h1').exists()).toBe(true))
  return { wrapper, router, flow }
}

const input = (wrapper: VueWrapper, label: string) => {
  const id = wrapper
    .findAll('label')
    .find((l) => l.text().startsWith(label))!
    .attributes('for')
  return wrapper.get(`#${id}`)
}
const button = (wrapper: VueWrapper, text: string) =>
  wrapper.findAll('button').find((b) => b.text() === text)!

describe('BookingDetailsView', () => {
  it('pusty formularz: pokazuje błędy i przenosi fokus na pierwsze złe pole', async () => {
    const { wrapper, router } = await mountAt('/rezerwacja/dane')

    await wrapper.get('form').trigger('submit')

    await vi.waitFor(() => expect(wrapper.text()).toContain('Podaj imię i nazwisko.'))
    expect(wrapper.text()).toContain('Podaj adres e-mail.')
    expect(wrapper.text()).toContain('Zaznacz zgodę')
    const nameInput = input(wrapper, 'Imię i nazwisko')
    expect(nameInput.attributes('aria-invalid')).toBe('true')
    expect(nameInput.attributes('aria-describedby')).toBeTruthy()
    await vi.waitFor(() => expect(document.activeElement).toBe(nameInput.element))
    expect(router.currentRoute.value.name).toBe('booking-details')
    wrapper.unmount()
  })

  it('poprawne dane trafiają do kreatora (znormalizowane) i prowadzą do podsumowania', async () => {
    const { wrapper, router, flow } = await mountAt('/rezerwacja/dane')

    await input(wrapper, 'Imię i nazwisko').setValue('Anna Nowak')
    await input(wrapper, 'E-mail').setValue('Anna@Example.com')
    await input(wrapper, 'Telefon').setValue('600 700 800')
    await wrapper.get('input[type="checkbox"]').setValue(true)
    await wrapper.get('form').trigger('submit')

    await vi.waitFor(() => expect(router.currentRoute.value.name).toBe('booking-summary'))
    expect(flow.customer).toEqual({
      name: 'Anna Nowak',
      email: 'anna@example.com',
      phone: '600700800',
      notes: undefined,
    })
    wrapper.unmount()
  })

  it('po powrocie z podsumowania pola są wypełnione', async () => {
    const { wrapper } = await mountAt('/rezerwacja/dane', { withCustomer: true })
    expect((input(wrapper, 'E-mail').element as HTMLInputElement).value).toBe(CUSTOMER.email)
    expect((wrapper.get('input[type="checkbox"]').element as HTMLInputElement).checked).toBe(true)
    wrapper.unmount()
  })
})

describe('BookingSummaryView', () => {
  it('potwierdzenie zapisuje rezerwację, czyści kreator i pokazuje kod', async () => {
    const { wrapper, router, flow } = await mountAt('/rezerwacja/podsumowanie', {
      withCustomer: true,
    })
    expect(wrapper.text()).toContain('Jan Kowalski')

    await button(wrapper, 'Potwierdź rezerwację').trigger('click')

    await vi.waitFor(() => expect(router.currentRoute.value.name).toBe('booking-confirmation'))
    const code = readDb().bookings[0]!.code
    expect(router.currentRoute.value.params.code).toBe(code)
    await vi.waitFor(() => expect(wrapper.text()).toContain(code))
    expect(wrapper.text()).toContain('Rezerwacja przyjęta')
    expect(flow.hasService).toBe(false)
    expect(flow.lastBooking?.code).toBe(code)
    wrapper.unmount()
  })

  it('podwójne kliknięcie wysyła tylko jedno zapytanie', async () => {
    const { wrapper } = await mountAt('/rezerwacja/podsumowanie', { withCustomer: true })
    const confirm = button(wrapper, 'Potwierdź rezerwację')
    await confirm.trigger('click')
    await confirm.trigger('click')
    await vi.waitFor(() => expect(wrapper.text()).toContain('Rezerwacja przyjęta'))
    expect(readDb().bookings).toHaveLength(1)
    wrapper.unmount()
  })

  it('409: komunikat i przejście do wyboru innego terminu', async () => {
    server.use(
      http.post('/api/bookings', () =>
        HttpResponse.json({ message: 'Ten termin został właśnie zajęty.' }, { status: 409 }),
      ),
    )
    const { wrapper, router, flow } = await mountAt('/rezerwacja/podsumowanie', {
      withCustomer: true,
    })

    await button(wrapper, 'Potwierdź rezerwację').trigger('click')
    await vi.waitFor(() => expect(wrapper.get('[role="alert"]').text()).toContain('zajęty'))

    await button(wrapper, 'Wybierz inny termin').trigger('click')
    await vi.waitFor(() => expect(router.currentRoute.value.name).toBe('booking-slot'))
    expect(flow.slot).toBeNull()
    expect(flow.customer).toEqual(CUSTOMER) // dane pacjenta zostają
    wrapper.unmount()
  })
})
