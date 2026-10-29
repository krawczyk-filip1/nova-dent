import { beforeEach, describe, it, expect } from 'vitest'
import { nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { FLOW_STORAGE_KEY, useBookingFlowStore } from '../bookingFlow'

const SLOT = {
  start: '2026-11-05T07:00:00.000Z',
  end: '2026-11-05T07:30:00.000Z',
  employeeId: 'emp-kowalska',
}

beforeEach(() => setActivePinia(createPinia()))

describe('useBookingFlowStore', () => {
  it('zmiana usługi czyści lekarza i termin', () => {
    const flow = useBookingFlowStore()
    flow.selectService('svc-przeglad')
    flow.selectEmployee('emp-kowalska')
    flow.selectSlot(SLOT)

    flow.selectService('svc-higienizacja')

    expect(flow.employeeId).toBe('any')
    expect(flow.slot).toBeNull()
  })

  it('ponowny wybór tej samej usługi niczego nie czyści', () => {
    const flow = useBookingFlowStore()
    flow.selectService('svc-przeglad')
    flow.selectSlot(SLOT)
    flow.selectService('svc-przeglad')
    expect(flow.slot).toEqual(SLOT)
  })

  it('zmiana lekarza czyści termin', () => {
    const flow = useBookingFlowStore()
    flow.selectService('svc-przeglad')
    flow.selectSlot(SLOT)
    flow.selectEmployee('emp-wisniewski')
    expect(flow.slot).toBeNull()
  })

  it('zapisuje stan w sessionStorage i odtwarza go po "odświeżeniu"', async () => {
    const flow = useBookingFlowStore()
    flow.selectService('svc-przeglad')
    flow.selectSlot(SLOT)
    await nextTick() // watch zapisuje po zmianie

    expect(JSON.parse(sessionStorage.getItem(FLOW_STORAGE_KEY)!)).toMatchObject({
      serviceId: 'svc-przeglad',
      slot: SLOT,
    })

    setActivePinia(createPinia()) // nowa instancja = jak po przeładowaniu strony
    const restored = useBookingFlowStore()
    expect(restored.serviceId).toBe('svc-przeglad')
    expect(restored.slot).toEqual(SLOT)
  })

  it('uszkodzony wpis w sessionStorage daje pusty kreator', () => {
    sessionStorage.setItem(FLOW_STORAGE_KEY, '{zepsute')
    const flow = useBookingFlowStore()
    expect(flow.hasService).toBe(false)
  })

  it('reset czyści wszystko', () => {
    const flow = useBookingFlowStore()
    flow.selectService('svc-przeglad')
    flow.selectSlot(SLOT)
    flow.reset()
    expect(flow.serviceId).toBeNull()
    expect(flow.slot).toBeNull()
  })
})
