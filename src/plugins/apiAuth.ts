import type { Pinia } from 'pinia'
import type { Router } from 'vue-router'
import { configureApiAuth } from '@/api/client'
import { useAuthStore } from '@/stores/auth'

export function installApiAuth(pinia: Pinia, router: Router) {
  const auth = useAuthStore(pinia)

  configureApiAuth({
    getToken: () => auth.token,
    onUnauthorized: () => {
      auth.clear({ expired: true })
      const current = router.currentRoute.value
      if (current.name === 'admin-login') return
      void router.push({
        name: 'admin-login',
        query: { powrot: current.fullPath, wygasla: '1' },
      })
    },
  })
}
