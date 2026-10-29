import { addHours } from 'date-fns'
import { HttpResponse } from 'msw'

export const SESSIONS_KEY = 'nova-dent:sessions:v1'
export const SESSION_HOURS = 8

/** Dane demo - w prawdziwej aplikacji hasło sprawdzałby backend, a w bazie leżałby tylko jego skrót. */
export const DEMO_ADMIN = { username: 'admin', password: 'admin', name: 'Recepcja Nova Dent' }

export interface Session {
  token: string
  expiresAt: string
}

function readSessions(now: Date): Session[] {
  try {
    const all = JSON.parse(localStorage.getItem(SESSIONS_KEY) ?? '[]') as Session[]
    return all.filter((s) => Date.parse(s.expiresAt) > now.getTime())
  } catch {
    return []
  }
}

function writeSessions(sessions: Session[]) {
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions))
}

export function createSession(now: Date): Session {
  const session = {
    token: crypto.randomUUID(),
    expiresAt: addHours(now, SESSION_HOURS).toISOString(),
  }
  writeSessions([...readSessions(now), session])
  return session
}

export function removeSession(token: string, now: Date) {
  writeSessions(readSessions(now).filter((s) => s.token !== token))
}

export function bearerToken(request: Request): string | null {
  const header = request.headers.get('Authorization') ?? ''
  const match = /^Bearer (.+)$/.exec(header)
  return match ? match[1]! : null
}

export function requireAdmin(request: Request, now = new Date()): Response | null {
  const token = bearerToken(request)
  if (token && readSessions(now).some((s) => s.token === token)) return null
  return HttpResponse.json(
    { message: 'Sesja wygasła lub nie jesteś zalogowany.' },
    { status: 401, headers: { 'WWW-Authenticate': 'Bearer' } },
  )
}
