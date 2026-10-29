import type { NavigationGuardWithThis, RouteLocationRaw } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useBookingFlowStore } from '@/stores/bookingFlow'

/**
 * Adres powrotu po zalogowaniu - tylko wewnątrz panelu. Bez tej kontroli link
 * /admin/login?powrot=https://zla-strona.pl przekierowałby po zalogowaniu na cudzą stronę.
 */
export function safeAdminRedirect(value: unknown): string | null {
  return typeof value === 'string' &&
    value.startsWith('/admin/') &&
    !value.startsWith('/admin/login')
    ? value
    : null
}

export const authGuard: NavigationGuardWithThis<undefined> = (to) => {
  const auth = useAuthStore()
  const needsAuth = to.matched.some((record) => record.meta.requiresAuth)

  if (needsAuth && !auth.isAuthenticated()) {
    // Była sesja, ale wygasła (czas minął albo serwer odrzucił token) - inaczej niż "nigdy nie logowano".
    const expired = auth.sessionExpired || auth.session !== null
    auth.clear({ expired })
    return {
      name: 'admin-login',
      query: { powrot: to.fullPath, ...(expired ? { wygasla: '1' } : {}) },
    }
  }
  if (to.name === 'admin-login' && auth.isAuthenticated()) {
    return safeAdminRedirect(to.query.powrot) ?? { name: 'admin-schedule' }
  }
  return true
}

/**
 * /rezerwacja/termin wymaga wybranej usługi.
 * Link z karty usługi niesie ją w adresie (?usluga=...) - zapisujemy ją w kreatorze
 * i przekierowujemy na czysty adres, żeby odświeżenie nie nadpisywało późniejszych wyborów.
 */
export const requireService: NavigationGuardWithThis<undefined> = (to) => {
  const flow = useBookingFlowStore()
  const fromQuery = to.query.usluga
  if (typeof fromQuery === 'string' && fromQuery) {
    flow.selectService(fromQuery)
    return { name: 'booking-slot', replace: true } satisfies RouteLocationRaw
  }
  return flow.hasService ? true : { name: 'services' }
}

function firstIncompleteStep(): RouteLocationRaw | null {
  const flow = useBookingFlowStore()
  if (!flow.hasService) return { name: 'services' }
  if (!flow.hasSlot) return { name: 'booking-slot' }
  if (!flow.hasCustomer) return { name: 'booking-details' }
  return null
}

export const requireSlot: NavigationGuardWithThis<undefined> = () => {
  const flow = useBookingFlowStore()
  return flow.hasSlot ? true : (firstIncompleteStep() ?? true)
}

export const requireCustomer: NavigationGuardWithThis<undefined> = () =>
  firstIncompleteStep() ?? true
