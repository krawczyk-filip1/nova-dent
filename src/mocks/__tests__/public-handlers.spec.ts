import { describe, it, expect } from 'vitest'
import { fetchEmployees, fetchServices } from '@/api/public'
import { updateDb } from '../db'

describe('publiczne API', () => {
  it('GET /api/services zwraca tylko aktywne usługi', async () => {
    const services = await fetchServices()
    expect(services.length).toBeGreaterThan(0)
    expect(services.every((s) => s.active)).toBe(true)
    expect(services.map((s) => s.id)).not.toContain('svc-fluoryzacja')
  })

  it('wyłączona w bazie usługa znika z listy', async () => {
    updateDb((db) => {
      db.services.find((s) => s.id === 'svc-higienizacja')!.active = false
    })
    const services = await fetchServices()
    expect(services.map((s) => s.id)).not.toContain('svc-higienizacja')
  })

  it('GET /api/employees?serviceId= zwraca tylko osoby wykonujące usługę', async () => {
    const employees = await fetchEmployees('svc-higienizacja')
    expect(employees.map((e) => e.id)).toEqual(['emp-zielinska'])
  })

  it('GET /api/employees bez filtra zwraca cały zespół', async () => {
    expect(await fetchEmployees()).toHaveLength(3)
  })
})
