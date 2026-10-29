import { delay, http, HttpResponse } from 'msw'
import type { LoginRequest, LoginResponse } from '@/types/api'
import { bearerToken, createSession, DEMO_ADMIN, removeSession } from '../auth'

export const authHandlers = [
  http.post('/api/auth/login', async ({ request }) => {
    await delay()
    const body = (await request.json().catch(() => null)) as Partial<LoginRequest> | null
    const ok =
      body?.username?.trim() === DEMO_ADMIN.username && body.password === DEMO_ADMIN.password
    // Ten sam komunikat dla złego loginu i złego hasła - nie podpowiadamy, które konto istnieje.
    if (!ok) {
      return HttpResponse.json({ message: 'Nieprawidłowy login lub hasło.' }, { status: 401 })
    }
    const session = createSession(new Date())
    return HttpResponse.json<LoginResponse>({
      token: session.token,
      expiresAt: session.expiresAt,
      name: DEMO_ADMIN.name,
    })
  }),

  http.post('/api/auth/logout', ({ request }) => {
    const token = bearerToken(request)
    if (token) removeSession(token, new Date())
    return new HttpResponse(null, { status: 204 })
  }),
]
