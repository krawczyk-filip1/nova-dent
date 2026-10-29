import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { createBooking } from '@/api/public'
import { clinicDateTime } from '@/lib/dates'
import { readDb } from '@/mocks/db'
import { routes } from '@/router/routes'
import App from '@/App.vue'

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(clinicDateTime('2026-11-02', '11:58'))
  setActivePinia(createPinia())
})
afterEach(() => vi.useRealTimers())

async function bookAndMount(path = '/moja-rezerwacja') {
  const booking = await createBooking({
    serviceId: 'svc-higienizacja',
    employeeId: 'emp-zielinska',
    start: clinicDateTime('2026-11-03', '13:00').toISOString(),
    customer: { name: 'Jan Kowalski', email: 'jan@example.com', phone: '600700800' },
  })
  const router = createRouter({ history: createMemoryHistory(), routes })
  await router.push(path.replace(':code', booking.code))
  const wrapper = mount(App, {
    global: { plugins: [createPinia(), router] },
    attachTo: document.body,
  })
  await vi.waitFor(() => expect(wrapper.find('h1').exists()).toBe(true))
  return { wrapper, booking }
}

const input = (wrapper: VueWrapper, label: string) => {
  const id = wrapper
    .findAll('label')
    .find((l) => l.text() === label)!
    .attributes('for')
  return wrapper.get(`#${id}`)
}
const button = (wrapper: VueWrapper, text: string) =>
  wrapper.findAll('button').find((b) => b.text() === text)

async function lookUp(wrapper: VueWrapper, code: string, email: string) {
  await input(wrapper, 'Kod rezerwacji').setValue(code)
  await input(wrapper, 'E-mail').setValue(email)
  await wrapper.get('form').trigger('submit')
}

describe('MyBookingView', () => {
  it('kod z adresu (?kod=) jest już wpisany w formularz', async () => {
    const { wrapper, booking } = await bookAndMount('/moja-rezerwacja?kod=:code')
    expect((input(wrapper, 'Kod rezerwacji').element as HTMLInputElement).value).toBe(booking.code)
    wrapper.unmount()
  })

  it('zły kod lub e-mail: jeden wspólny komunikat', async () => {
    const { wrapper, booking } = await bookAndMount()
    await lookUp(wrapper, booking.code, 'ktos@example.com')
    await vi.waitFor(() =>
      expect(wrapper.get('[role="alert"]').text()).toContain('Nie znaleźliśmy rezerwacji'),
    )
    wrapper.unmount()
  })

  it('niepoprawny format kodu łapie już formularz, bez pytania serwera', async () => {
    const { wrapper } = await bookAndMount()
    await lookUp(wrapper, 'BK-12', 'jan@example.com')
    await vi.waitFor(() => expect(wrapper.text()).toContain('Kod ma postać BK- i 6 znaków'))
    wrapper.unmount()
  })

  it('pokazuje rezerwację i odwołuje ją w dwóch krokach', async () => {
    const { wrapper, booking } = await bookAndMount()
    await lookUp(wrapper, booking.code.toLowerCase(), 'JAN@example.com')

    await vi.waitFor(() => expect(wrapper.text()).toContain('Czeka na potwierdzenie gabinetu'))
    expect(wrapper.text()).toContain('Higienizacja')
    expect(wrapper.text()).toContain('wtorek, 3 listopada 2026, 13:00')
    expect(wrapper.text()).toContain('2 listopada, 13:00') // do kiedy można odwołać online
    expect(document.activeElement?.textContent).toContain(booking.code)

    await button(wrapper, 'Odwołaj wizytę')!.trigger('click')
    expect(readDb().bookings[0]!.status).toBe('pending') // pierwszy klik tylko pyta
    expect(wrapper.text()).toContain('Na pewno odwołać wizytę?')

    await button(wrapper, 'Tak, odwołaj')!.trigger('click')

    await vi.waitFor(() =>
      expect(wrapper.get('[role="status"]').text()).toContain('Wizyta odwołana'),
    )
    expect(wrapper.text()).toContain('Odwołana')
    expect(button(wrapper, 'Odwołaj wizytę')).toBeUndefined()
    expect(readDb().bookings[0]!.status).toBe('cancelled')
    wrapper.unmount()
  })

  it('"Nie, zostaw" wycofuje się bez zmian', async () => {
    const { wrapper, booking } = await bookAndMount()
    await lookUp(wrapper, booking.code, 'jan@example.com')
    await vi.waitFor(() => expect(button(wrapper, 'Odwołaj wizytę')).toBeDefined())
    await button(wrapper, 'Odwołaj wizytę')!.trigger('click')
    await button(wrapper, 'Nie, zostaw')!.trigger('click')
    expect(button(wrapper, 'Odwołaj wizytę')).toBeDefined()
    expect(readDb().bookings[0]!.status).toBe('pending')
    wrapper.unmount()
  })

  it('mniej niż 24 h przed wizytą: zamiast przycisku numer telefonu', async () => {
    const { wrapper, booking } = await bookAndMount()
    vi.setSystemTime(clinicDateTime('2026-11-02', '14:00'))
    await lookUp(wrapper, booking.code, 'jan@example.com')

    await vi.waitFor(() => expect(wrapper.text()).toContain('tylko telefonicznie'))
    expect(button(wrapper, 'Odwołaj wizytę')).toBeUndefined()
    expect(wrapper.find('a[href^="tel:"]').exists()).toBe(true)
    wrapper.unmount()
  })
})
