import { beforeEach, describe, it, expect } from 'vitest'
import { defineComponent } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { useBookingFlowStore } from '@/stores/bookingFlow'
import { requireService, requireSlot } from '../guards'

const Empty = defineComponent({ render: () => null })

function makeRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'services', component: Empty },
      {
        path: '/rezerwacja/termin',
        name: 'booking-slot',
        component: Empty,
        beforeEnter: requireService,
      },
      {
        path: '/rezerwacja/dane',
        name: 'booking-details',
        component: Empty,
        beforeEnter: requireSlot,
      },
    ],
  })
}

beforeEach(() => setActivePinia(createPinia()))

describe('guardy kreatora', () => {
  it('bez wybranej usługi wybór terminu wraca na listę usług', async () => {
    const router = makeRouter()
    await router.push('/rezerwacja/termin')
    expect(router.currentRoute.value.name).toBe('services')
  })

  it('?usluga= z adresu zapisuje usługę i przekierowuje na czysty adres', async () => {
    const router = makeRouter()
    await router.push('/rezerwacja/termin?usluga=svc-przeglad')
    expect(router.currentRoute.value.fullPath).toBe('/rezerwacja/termin')
    expect(useBookingFlowStore().serviceId).toBe('svc-przeglad')
  })

  it('dane pacjenta bez terminu: wraca do wyboru terminu albo na listę usług', async () => {
    const router = makeRouter()
    await router.push('/rezerwacja/dane')
    expect(router.currentRoute.value.name).toBe('services')

    useBookingFlowStore().selectService('svc-przeglad')
    await router.push('/rezerwacja/dane')
    expect(router.currentRoute.value.name).toBe('booking-slot')
  })

  it('z wybranym terminem wpuszcza do danych pacjenta', async () => {
    const flow = useBookingFlowStore()
    flow.selectService('svc-przeglad')
    flow.selectSlot({ start: 'a', end: 'b', employeeId: 'emp-kowalska' })
    const router = makeRouter()
    await router.push('/rezerwacja/dane')
    expect(router.currentRoute.value.name).toBe('booking-details')
  })
})
