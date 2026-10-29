import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import { login as apiLogin, logout as apiLogout } from '@/api/auth'
import type { LoginRequest } from '@/types/api'

interface AdminSession {
  token: string
  expiresAt: string
  name: string
}

export const AUTH_STORAGE_KEY = 'nova-dent:auth:v1'

function loadSession(): AdminSession | null {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY)
    return raw ? (JSON.parse(raw) as AdminSession) : null
  } catch {
    return null
  }
}

export const useAuthStore = defineStore('auth', () => {
  const session = ref<AdminSession | null>(loadSession())
  const sessionExpired = ref(false)

  const token = computed(() => session.value?.token ?? null)
  const userName = computed(() => session.value?.name ?? '')

  /**
   * Czy jest ważna sesja. Funkcja, a nie computed: czas płynie, a computed przeliczyłby się
   * dopiero przy zmianie `session` - po 8 h wciąż mówiłby "zalogowany".
   */
  function isAuthenticated(now = Date.now()): boolean {
    return !!session.value && Date.parse(session.value.expiresAt) > now
  }

  async function login(credentials: LoginRequest) {
    const response = await apiLogin(credentials)
    session.value = response
    sessionExpired.value = false
  }

  async function logout() {
    if (session.value) await apiLogout().catch(() => {})
    clear()
  }

  function clear({ expired = false } = {}) {
    session.value = null
    if (expired) sessionExpired.value = true
  }

  watch(session, (value) => {
    if (value) localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(value))
    else localStorage.removeItem(AUTH_STORAGE_KEY)
  })

  return { session, sessionExpired, token, userName, isAuthenticated, login, logout, clear }
})
