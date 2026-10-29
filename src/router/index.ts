import { createRouter, createWebHistory, type RouterHistory } from 'vue-router'
import { CLINIC } from '@/constants/clinic'
import { authGuard } from './guards'
import { routes } from './routes'

export function createAppRouter(history: RouterHistory) {
  const router = createRouter({
    history,
    routes,
    scrollBehavior: (_to, _from, savedPosition) => savedPosition ?? { top: 0 },
  })

  router.beforeEach(authGuard)

  router.afterEach((to) => {
    document.title = to.meta.title ? `${to.meta.title} · ${CLINIC.name}` : CLINIC.name
  })

  return router
}

export default createAppRouter(createWebHistory(import.meta.env.BASE_URL))
