import { describe, it, expect, vi } from 'vitest'
import type { VueWrapper } from '@vue/test-utils'
import { SESSIONS_KEY } from '@/mocks/auth'
import { safeAdminRedirect } from '@/router/guards'
import { AUTH_STORAGE_KEY, useAuthStore } from '@/stores/auth'
import { mountApp } from '@/test/app'

const input = (wrapper: VueWrapper, label: string) => {
  const id = wrapper
    .findAll('label')
    .find((l) => l.text() === label)!
    .attributes('for')
  return wrapper.get(`#${id}`)
}

async function logIn(wrapper: VueWrapper, username: string, password: string) {
  await input(wrapper, 'Login').setValue(username)
  await input(wrapper, 'Hasło').setValue(password)
  await wrapper.get('form').trigger('submit')
}

describe('safeAdminRedirect', () => {
  it.each([
    ['/admin/uslugi', '/admin/uslugi'],
    ['/admin/grafik?widok=tydzien', '/admin/grafik?widok=tydzien'],
    ['https://zla-strona.pl', null],
    ['//zla-strona.pl', null],
    ['/rezerwacja/termin', null],
    ['/admin/login', null],
    [undefined, null],
  ])('%j -> %j', (value, expected) => {
    expect(safeAdminRedirect(value)).toBe(expected)
  })
})

describe('logowanie do panelu', () => {
  it('niezalogowany: /admin/uslugi przekierowuje na logowanie z adresem powrotu', async () => {
    const { wrapper, router } = await mountApp('/admin/uslugi')
    expect(router.currentRoute.value.name).toBe('admin-login')
    expect(router.currentRoute.value.query.powrot).toBe('/admin/uslugi')
    wrapper.unmount()
  })

  it('złe hasło: komunikat, wyczyszczone hasło, dalej ekran logowania', async () => {
    const { wrapper, router } = await mountApp('/admin/login')
    await logIn(wrapper, 'admin', 'zle')

    await vi.waitFor(() =>
      expect(wrapper.get('[role="alert"]').text()).toBe('Nieprawidłowy login lub hasło.'),
    )
    expect((input(wrapper, 'Hasło').element as HTMLInputElement).value).toBe('')
    expect(router.currentRoute.value.name).toBe('admin-login')
    wrapper.unmount()
  })

  it('poprawne dane: wraca na stronę, z której przekierowano, i zapamiętuje sesję', async () => {
    const { wrapper, router } = await mountApp('/admin/uslugi')
    await logIn(wrapper, 'admin', 'admin')

    await vi.waitFor(() => expect(router.currentRoute.value.fullPath).toBe('/admin/uslugi'))
    expect(JSON.parse(localStorage.getItem(AUTH_STORAGE_KEY)!).name).toBe('Recepcja Nova Dent')
    await vi.waitFor(() => expect(wrapper.text()).toContain('Zalogowano: Recepcja Nova Dent'))
    wrapper.unmount()
  })

  it('zalogowany admin wchodzący na /admin/login trafia do grafiku', async () => {
    const first = await mountApp('/admin/login')
    await logIn(first.wrapper, 'admin', 'admin')
    await vi.waitFor(() => expect(first.router.currentRoute.value.name).toBe('admin-schedule'))
    first.wrapper.unmount()

    const second = await mountApp('/admin/login')
    expect(second.router.currentRoute.value.name).toBe('admin-schedule')
    second.wrapper.unmount()
  })

  it('wylogowanie czyści sesję i wraca do logowania', async () => {
    const { wrapper, router } = await mountApp('/admin/login')
    await logIn(wrapper, 'admin', 'admin')
    await vi.waitFor(() => expect(wrapper.text()).toContain('Wyloguj'))

    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Wyloguj')!
      .trigger('click')

    await vi.waitFor(() => expect(router.currentRoute.value.name).toBe('admin-login'))
    expect(localStorage.getItem(AUTH_STORAGE_KEY)).toBeNull()
    expect(JSON.parse(localStorage.getItem(SESSIONS_KEY)!)).toEqual([])
    wrapper.unmount()
  })

  it('serwer odrzuca token (401): wylogowanie i powrót na logowanie z informacją', async () => {
    const { wrapper, router } = await mountApp('/admin/login')
    await logIn(wrapper, 'admin', 'admin')
    // Czekamy, aż grafik skończy swoje pierwsze zapytanie - inaczej wróciłoby ono z 401 w trakcie
    // kolejnej nawigacji i test sprawdzałby wyścig zamiast samej obsługi 401.
    await vi.waitFor(() => expect(wrapper.text()).toMatch(/\d+ wizyt/))

    // "Serwer" zapomina sesję (np. wygasła) - kolejne zapytanie z panelu dostaje 401.
    localStorage.setItem(SESSIONS_KEY, '[]')
    await router.push('/admin/statystyki')
    await router.push('/admin/grafik') // grafik pyta o rezerwacje

    await vi.waitFor(() => expect(router.currentRoute.value.query.wygasla).toBe('1'))
    expect(router.currentRoute.value.name).toBe('admin-login')
    expect(router.currentRoute.value.query.powrot).toBe('/admin/grafik')
    expect(useAuthStore().isAuthenticated()).toBe(false)
    await vi.waitFor(() => expect(wrapper.text()).toContain('Sesja wygasła'))
    wrapper.unmount()
  })

  it('sesja wygasła z upływem czasu: guard też informuje "sesja wygasła"', async () => {
    localStorage.setItem(
      AUTH_STORAGE_KEY,
      JSON.stringify({ token: 't', name: 'Recepcja', expiresAt: '2000-01-01T00:00:00Z' }),
    )
    const { wrapper, router } = await mountApp('/admin/blokady')
    expect(router.currentRoute.value.query).toEqual({ powrot: '/admin/blokady', wygasla: '1' })
    expect(localStorage.getItem(AUTH_STORAGE_KEY)).toBeNull()
    wrapper.unmount()
  })
})
