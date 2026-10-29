export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly body: unknown = null,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

type Query = Record<string, string | number | undefined>

interface AuthHooks {
  getToken: () => string | null
  onUnauthorized: () => void
}

// Klient nie importuje store'a ani routera - dostaje te funkcje z zewnątrz (zob. plugins/apiAuth.ts).
// Dzięki temu nie ma zależności cyklicznych, a w testach można podstawić cokolwiek.
let auth: AuthHooks = { getToken: () => null, onUnauthorized: () => {} }

export function configureApiAuth(hooks: AuthHooks) {
  auth = hooks
}

function buildUrl(path: string, query?: Query): URL {
  // Pełny adres zamiast względnego - fetch w Node (testy) nie rozumie samego "/api/...".
  const url = new URL(path, window.location.origin)
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined) url.searchParams.set(key, String(value))
  }
  return url
}

async function request<T>(
  method: string,
  path: string,
  { query, body }: { query?: Query; body?: unknown } = {},
): Promise<T> {
  const token = auth.getToken()
  const headers: Record<string, string> = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (token) headers.Authorization = `Bearer ${token}`

  let response: Response
  try {
    response = await fetch(buildUrl(path, query), {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ApiError(0, 'Brak połączenia z serwerem.')
  }

  const data: unknown = response.status === 204 ? null : await response.json().catch(() => null)
  if (!response.ok) {
    // 401 przy wysłanym tokenie = sesja nieważna. Bez tokenu (np. złe hasło) to zwykły błąd formularza.
    if (response.status === 401 && token) auth.onUnauthorized()
    const message =
      data && typeof data === 'object' && 'message' in data && typeof data.message === 'string'
        ? data.message
        : `Błąd serwera (${response.status}).`
    throw new ApiError(response.status, message, data)
  }
  return data as T
}

export const api = {
  get: <T>(path: string, query?: Query) => request<T>('GET', path, { query }),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, { body }),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, { body }),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, { body }),
  delete: <T>(path: string) => request<T>('DELETE', path),
}
