import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { routes } from '@/router/routes'
import { CLINIC } from '@/constants/clinic'
import App from '@/App.vue'

describe('ClientLayout', () => {
  it('pokazuje nazwę gabinetu, menu i dane w stopce', async () => {
    const router = createRouter({ history: createMemoryHistory(), routes })
    await router.push('/')
    const wrapper = mount(App, { global: { plugins: [createPinia(), router] } })

    expect(wrapper.text()).toContain(CLINIC.name)
    expect(wrapper.get('nav[aria-label="Główna"]').text()).toContain('Moja rezerwacja')
    expect(wrapper.get('footer').text()).toContain(CLINIC.address)
  })
})
