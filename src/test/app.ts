import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory } from 'vue-router'
import { installApiAuth } from '@/plugins/apiAuth'
import { createAppRouter } from '@/router'
import App from '@/App.vue'

export async function mountApp(path: string) {
  const pinia = createPinia()
  setActivePinia(pinia)
  const router = createAppRouter(createMemoryHistory())
  installApiAuth(pinia, router)
  await router.push(path)
  const wrapper = mount(App, { global: { plugins: [pinia, router] }, attachTo: document.body })
  return { wrapper, router, pinia }
}
