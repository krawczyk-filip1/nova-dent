import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import { fetchStats } from '@/api/admin'
import { ApiError, configureApiAuth } from '@/api/client'
import { clinicDateTime } from '@/lib/dates'
import { mountApp } from '@/test/app'
import { addBooking, signInAsAdmin } from '@/test/fixtures'

// Środa 4.11.2026, 11:58. "Ostatnie 7 dni" = 29.10-4.11, poprzednie = 22.10-28.10.
beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(clinicDateTime('2026-11-04', '11:58'))
  const { token } = await signInAsAdmin()
  configureApiAuth({ getToken: () => token, onUnauthorized: () => {} })

  // Bieżący tydzień: 3 wizyty (2 zakończone: przegląd 150 zł + higienizacja 350 zł) i 1 odwołana.
  addBooking({ date: '2026-11-02', start: '08:00', end: '08:30', status: 'completed' })
  addBooking({
    date: '2026-11-03',
    start: '09:00',
    end: '10:00',
    status: 'completed',
    serviceId: 'svc-higienizacja',
    employeeId: 'emp-zielinska',
  })
  addBooking({ date: '2026-11-04', start: '14:00', end: '14:30', status: 'confirmed' })
  addBooking({ date: '2026-11-04', start: '15:00', end: '15:30', status: 'cancelled' })
  // Poprzedni tydzień: 2 wizyty.
  addBooking({ date: '2026-10-26', start: '08:00', end: '08:30', status: 'completed' })
  addBooking({ date: '2026-10-27', start: '08:00', end: '08:30', status: 'completed' })
})
afterEach(() => vi.useRealTimers())

describe('GET /api/admin/stats', () => {
  it('zwraca bieżący i poprzedni okres tej samej długości', async () => {
    const { current, previous } = await fetchStats({ from: '2026-10-29', to: '2026-11-04' })
    expect(current).toMatchObject({ visits: 3, completed: 2, cancelled: 1, revenueGrosze: 500_00 })
    expect(previous).toMatchObject({ from: '2026-10-22', to: '2026-10-28', visits: 2 })
  })

  it('422 dla zakresu dłuższego niż rok', async () => {
    await expect(fetchStats({ from: '2025-01-01', to: '2026-11-04' })).rejects.toEqual(
      expect.objectContaining({ name: ApiError.name, status: 422 }),
    )
  })
})

describe('AdminStatsView', () => {
  async function open(query: string) {
    const app = await mountApp(`/admin/statystyki${query}`)
    await vi.waitFor(() =>
      expect(app.wrapper.find('[aria-label="Najważniejsze liczby"]').exists()).toBe(true),
    )
    return app
  }

  it('kafelki: liczby, zmiana słowami i porównanie z poprzednim okresem', async () => {
    const { wrapper } = await open('?zakres=7d')
    const tiles = wrapper.get('[aria-label="Najważniejsze liczby"]').text().replace(/ /g, ' ')
    expect(tiles).toContain('Wizyty3▲ wzrost o 50% vs poprzednie 7 dni')
    expect(tiles).toContain('Przychód500 zł▲ wzrost o 67%') // 500 zł vs 300 zł
    expect(tiles).toContain('Odwołania25%') // 1 z 4
    expect(wrapper.text()).toContain('29 października 2026 – 4 listopada 2026')
    wrapper.unmount()
  })

  it('zmiana zakresu przez przycisk aktualizuje adres i dane', async () => {
    const { wrapper, router } = await open('?zakres=7d')
    await wrapper
      .findAll('nav[aria-label="Zakres dat"] a')
      .find((a) => a.text() === 'Ten miesiąc')!
      .trigger('click')
    await vi.waitFor(() => expect(router.currentRoute.value.query.zakres).toBe('ten-miesiac'))
    await vi.waitFor(() => expect(wrapper.text()).toContain('1 listopada 2026 – 30 listopada 2026'))
    wrapper.unmount()
  })

  it('własny zakres dat', async () => {
    const { wrapper, router } = await open('?zakres=7d')
    const [from, to] = wrapper.findAll('input[type="date"]')
    await from!.setValue('2026-10-26')
    await to!.setValue('2026-10-27')
    await wrapper.get('form').trigger('submit')
    await vi.waitFor(() =>
      expect(router.currentRoute.value.query).toEqual({ od: '2026-10-26', do: '2026-10-27' }),
    )
    await vi.waitFor(() =>
      expect(wrapper.get('[aria-label="Najważniejsze liczby"]').text()).toMatch(/^Wizyty2/),
    )
    wrapper.unmount()
  })

  it('wykres: opis każdego słupka, tabela z tymi samymi danymi, strzałki przenoszą fokus', async () => {
    const { wrapper } = await open('?zakres=7d')
    const bars = wrapper.findAll('[aria-label="Liczba wizyt w kolejnych dniach"] [data-bar]')
    expect(bars).toHaveLength(7)
    expect(bars[4]!.attributes('aria-label')).toBe('poniedziałek, 2 listopada: 1 wizyta')
    expect(wrapper.findAll('details table tbody tr')[4]!.text()).toBe('pon, 2.111')

    // Do wykresu wchodzi się jednym Tabem (tylko pierwszy słupek ma tabindex=0), dalej strzałki.
    expect(bars.filter((b) => b.attributes('tabindex') === '0')).toHaveLength(1)
    ;(bars[0]!.element as HTMLElement).focus()
    await wrapper
      .get('[aria-label="Liczba wizyt w kolejnych dniach"]')
      .trigger('keydown', { key: 'End' })
    expect(document.activeElement).toBe(bars[6]!.element)
    wrapper.unmount()
  })

  it('obłożenie i usługi', async () => {
    const { wrapper } = await open('?zakres=7d')
    const meter = wrapper.get('[role="meter"][aria-label="hig. stom. Marta Zielińska"]')
    // Zielińska w tym tygodniu: czw 29.10, sob 31.10, wt 3.11 -> 8 + 5 + 8 = 21 h; zajęta 1 h -> 5%.
    expect(meter.attributes('aria-valuenow')).toBe('5')
    expect(wrapper.text()).toContain('Przegląd i konsultacja2')
    wrapper.unmount()
  })
})
