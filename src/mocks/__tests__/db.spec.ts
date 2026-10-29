import { describe, it, expect } from 'vitest'
import { readDb, resetDb, STORAGE_KEY, updateDb } from '../db'
import { seedServices } from '../seed'

describe('db (localStorage)', () => {
  it('przy pierwszym odczycie zapisuje seed', () => {
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
    const data = readDb()
    expect(data.services).toHaveLength(seedServices.length)
    expect(localStorage.getItem(STORAGE_KEY)).not.toBeNull()
  })

  it('zmiany z updateDb są widoczne w kolejnym odczycie', () => {
    updateDb((db) => {
      db.services[0]!.name = 'Zmieniona nazwa'
    })
    expect(readDb().services[0]!.name).toBe('Zmieniona nazwa')
  })

  it('zmiany w bazie nie psują stałych seeda, a reset przywraca stan początkowy', () => {
    const original = seedServices[0]!.name
    updateDb((db) => {
      db.services[0]!.name = 'Zmieniona nazwa'
    })
    expect(seedServices[0]!.name).toBe(original)
    expect(resetDb().services[0]!.name).toBe(original)
  })

  it('uszkodzony JSON zastępuje seedem zamiast wywracać aplikację', () => {
    localStorage.setItem(STORAGE_KEY, '{to nie jest json')
    expect(readDb().services).toHaveLength(seedServices.length)
  })
})
