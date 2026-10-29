import { describe, it, expect } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { routes } from '../routes'

function makeRouter() {
  return createRouter({ history: createMemoryHistory(), routes })
}

describe('trasy', () => {
  it.each([
    ['/', 'services'],
    ['/rezerwacja/termin', 'booking-slot'],
    ['/rezerwacja/dane', 'booking-details'],
    ['/rezerwacja/podsumowanie', 'booking-summary'],
    ['/rezerwacja/BK-7F3K9Q', 'booking-confirmation'],
    ['/moja-rezerwacja', 'my-booking'],
    ['/admin/login', 'admin-login'],
    ['/admin/grafik', 'admin-schedule'],
    ['/admin/statystyki', 'admin-stats'],
    ['/nie-ma-takiej', 'not-found'],
  ])('%s -> %s', (path, name) => {
    expect(makeRouter().resolve(path).name).toBe(name)
  })

  it('stałe ścieżki rezerwacji nie są brane za kod rezerwacji', () => {
    const route = makeRouter().resolve('/rezerwacja/termin')
    expect(route.params.code).toBeUndefined()
  })

  it('/admin przekierowuje na grafik', async () => {
    const router = makeRouter()
    await router.push('/admin')
    expect(router.currentRoute.value.name).toBe('admin-schedule')
  })

  it('panel admina jest oznaczony jako wymagający logowania, a logowanie nie', () => {
    const router = makeRouter()
    expect(router.resolve('/admin/uslugi').meta.requiresAuth).toBe(true)
    expect(router.resolve('/admin/login').meta.requiresAuth).toBeUndefined()
  })
})
