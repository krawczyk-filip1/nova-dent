import type { Booking, Employee, Service, TimeBlock } from '@/types/models'
import { generateDemoBookings } from './demoBookings'
import { seedBlocks, seedEmployees, seedServices } from './seed'

// "Baza danych" mock API trzymana w localStorage, więc rezerwacje przeżywają odświeżenie strony.
// Zmiana kształtu lub zawartości seeda -> podbij numer w kluczu, a stare dane zostaną zastąpione.
export const STORAGE_KEY = 'nova-dent:db:v1'

/**
 * Rezerwacje demo tylko w aplikacji. Testy startują z pustym kalendarzem - inaczej każdy test
 * zależałby od losowego rozkładu wizyt (generator ma własne testy).
 */
const WITH_DEMO_BOOKINGS = import.meta.env.MODE !== 'test'

export interface DbData {
  services: Service[]
  employees: Employee[]
  blocks: TimeBlock[]
  bookings: Booking[]
}

function createSeed(now = new Date()): DbData {
  const base = structuredClone({
    services: seedServices,
    employees: seedEmployees,
    blocks: seedBlocks,
  })
  return { ...base, bookings: WITH_DEMO_BOOKINGS ? generateDemoBookings(base, now) : [] }
}

export function readDb(): DbData {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (raw) {
    try {
      return JSON.parse(raw) as DbData
    } catch {}
  }
  const seed = createSeed()
  writeDb(seed)
  return seed
}

export function writeDb(data: DbData): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

export function updateDb<T>(change: (data: DbData) => T): T {
  const data = readDb()
  const result = change(data)
  writeDb(data)
  return result
}

export function resetDb(): DbData {
  const seed = createSeed()
  writeDb(seed)
  return seed
}
