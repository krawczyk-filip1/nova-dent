import { describe, it, expect, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/server'
import { routes } from '@/router/routes'
import ServicesView from '../ServicesView.vue'

async function mountView() {
  const router = createRouter({ history: createMemoryHistory(), routes })
  await router.push('/')
  return mount(ServicesView, { global: { plugins: [createPinia(), router] } })
}

async function waitForLoaded(wrapper: VueWrapper) {
  await vi.waitFor(() => expect(wrapper.find('[aria-busy="true"]').exists()).toBe(false))
}

describe('ServicesView', () => {
  it('najpierw pokazuje szkielet, potem usługi z ceną i czasem', async () => {
    const wrapper = await mountView()
    expect(wrapper.find('[aria-busy="true"]').exists()).toBe(true)

    await waitForLoaded(wrapper)

    const text = wrapper.text().replace(/ /g, ' ')
    expect(text).toContain('Higienizacja')
    expect(text).toContain('350 zł')
    expect(text).toContain('od 900 zł')
    expect(text).toContain('1 h 30 min')
    expect(text).not.toContain('Fluoryzacja')
  })

  it('karta usługi prowadzi do wyboru terminu z id usługi w adresie', async () => {
    const wrapper = await mountView()
    await waitForLoaded(wrapper)
    const link = wrapper.get('a[href*="usluga=svc-higienizacja"]')
    expect(link.attributes('href')).toBe('/rezerwacja/termin?usluga=svc-higienizacja')
  })

  it('przy błędzie serwera pokazuje komunikat i pozwala spróbować ponownie', async () => {
    server.use(
      http.get('/api/services', () => HttpResponse.json(null, { status: 500 }), { once: true }),
    )
    const wrapper = await mountView()
    await vi.waitFor(() => expect(wrapper.find('[role="alert"]').exists()).toBe(true))
    expect(wrapper.get('[role="alert"]').text()).toContain('Nie udało się pobrać listy usług')

    await wrapper.get('[role="alert"] button').trigger('click')
    await vi.waitFor(() => expect(wrapper.text()).toContain('Higienizacja'))
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
  })
})
