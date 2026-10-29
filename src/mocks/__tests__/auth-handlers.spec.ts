import { afterEach, describe, it, expect, vi } from 'vitest'
import { fetchAdminBookings, resetDemo } from '@/api/admin'
import { login, logout } from '@/api/auth'
import { ApiError, configureApiAuth } from '@/api/client'

const apiError = (status: number) => expect.objectContaining({ name: ApiError.name, status })
const range = { from: '2026-11-02', to: '2026-11-08' }

function useToken(token: string | null) {
  configureApiAuth({ getToken: () => token, onUnauthorized: () => {} })
}

afterEach(() => vi.useRealTimers())

describe('logowanie (mock API)', () => {
  it('admin/admin daje token ważny 8 godzin', async () => {
    const response = await login({ username: 'admin', password: 'admin' })
    expect(response.token).toMatch(/^[0-9a-f-]{36}$/)
    expect(response.name).toBe('Recepcja Nova Dent')
    const hours = (Date.parse(response.expiresAt) - Date.now()) / 3_600_000
    expect(hours).toBeCloseTo(8, 1)
  })

  it('zły login i złe hasło dają ten sam błąd 401', async () => {
    const badUser = await login({ username: 'root', password: 'admin' }).catch((e: ApiError) => e)
    const badPass = await login({ username: 'admin', password: 'x' }).catch((e: ApiError) => e)
    expect(badUser).toEqual(apiError(401))
    expect((badUser as ApiError).message).toBe((badPass as ApiError).message)
  })

  it('endpointy admina bez tokenu lub z cudzym tokenem -> 401', async () => {
    await expect(fetchAdminBookings(range)).rejects.toEqual(apiError(401))
    useToken('wymyslony-token')
    await expect(fetchAdminBookings(range)).rejects.toEqual(apiError(401))
    await expect(resetDemo()).rejects.toEqual(apiError(401))
  })

  it('z ważnym tokenem -> 200', async () => {
    const { token } = await login({ username: 'admin', password: 'admin' })
    useToken(token)
    await expect(fetchAdminBookings(range)).resolves.toEqual([])
  })

  it('token wygasa po 8 godzinach', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-02T08:00:00Z'))
    const { token } = await login({ username: 'admin', password: 'admin' })
    useToken(token)

    vi.setSystemTime(new Date('2026-11-02T15:59:00Z'))
    await expect(fetchAdminBookings(range)).resolves.toEqual([])

    vi.setSystemTime(new Date('2026-11-02T16:01:00Z'))
    await expect(fetchAdminBookings(range)).rejects.toEqual(apiError(401))
  })

  it('po wylogowaniu token przestaje działać', async () => {
    const { token } = await login({ username: 'admin', password: 'admin' })
    useToken(token)
    await logout()
    await expect(fetchAdminBookings(range)).rejects.toEqual(apiError(401))
  })

  it('401 z wysłanym tokenem wywołuje onUnauthorized, a złe hasło - nie', async () => {
    const onUnauthorized = vi.fn<() => void>()
    configureApiAuth({ getToken: () => 'stary-token', onUnauthorized })
    await fetchAdminBookings(range).catch(() => {})
    expect(onUnauthorized).toHaveBeenCalledTimes(1)

    configureApiAuth({ getToken: () => null, onUnauthorized })
    await login({ username: 'admin', password: 'zle' }).catch(() => {})
    expect(onUnauthorized).toHaveBeenCalledTimes(1)
  })
})
