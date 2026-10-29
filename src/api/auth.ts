import type { LoginRequest, LoginResponse } from '@/types/api'
import { api } from './client'

export function login(credentials: LoginRequest) {
  return api.post<LoginResponse>('/api/auth/login', credentials)
}

export function logout() {
  return api.post<null>('/api/auth/logout')
}
