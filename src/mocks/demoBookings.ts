import { addHours, addMinutes, subDays } from 'date-fns'
import { addDaysToKey, clinicDateTime, toClinicDateKey } from '@/lib/dates'
import type { Booking, BookingStatus, Customer, Employee, Service, TimeBlock } from '@/types/models'
import { generateBookingCode } from '@/utils/bookingCode'
import { pick, seededRandom } from '@/utils/random'
import { generateSlots } from '@/utils/slots'

const PATIENTS: [string, string][] = [
  ['Jan', 'Kowalczyk'],
  ['Katarzyna', 'Lewandowska'],
  ['Tomasz', 'Kamiński'],
  ['Agnieszka', 'Wójcik'],
  ['Michał', 'Szymański'],
  ['Magdalena', 'Woźniak'],
  ['Paweł', 'Dąbrowski'],
  ['Joanna', 'Kozłowska'],
  ['Krzysztof', 'Jankowski'],
  ['Aleksandra', 'Mazur'],
  ['Marcin', 'Krawczyk'],
  ['Monika', 'Piotrowska'],
  ['Łukasz', 'Grabowski'],
  ['Natalia', 'Pawłowska'],
  ['Grzegorz', 'Michalski'],
  ['Ewa', 'Nowicka'],
  ['Adam', 'Adamczyk'],
  ['Zofia', 'Dudek'],
  ['Piotr', 'Zając'],
  ['Julia', 'Wieczorek'],
]

const NOTES = ['Boli ząb po lewej stronie.', 'Uczulenie na penicylinę.', 'Proszę o znieczulenie.']

function emailLocalPart(first: string, last: string): string {
  return `${first}.${last}`.toLowerCase().replace(/ł/g, 'l').normalize('NFD').replace(/[̀-ͯ]/g, '')
}

function demoCustomer(random: () => number): Customer {
  const [first, last] = pick(random, PATIENTS)
  const phone = '5' + String(Math.floor(random() * 1e8)).padStart(8, '0')
  return {
    name: `${first} ${last}`,
    email: `${emailLocalPart(first, last)}@example.com`,
    phone,
    notes: random() < 0.15 ? pick(random, NOTES) : undefined,
  }
}

function demoStatus(random: () => number, start: Date, end: Date, now: Date): BookingStatus {
  const r = random()
  if (end <= now) return r < 0.85 ? 'completed' : 'cancelled'
  if (start <= now) return 'confirmed'
  const daysAhead = (start.getTime() - now.getTime()) / 86_400_000
  if (daysAhead < 2) return r < 0.7 ? 'confirmed' : 'pending'
  return r < 0.5 ? 'pending' : r < 0.9 ? 'confirmed' : 'cancelled'
}

function demoHistory(status: BookingStatus, createdAt: Date, end: Date) {
  const history = [{ status: 'pending' as BookingStatus, changedAt: createdAt.toISOString() }]
  const confirmedAt = addHours(createdAt, 2).toISOString()
  if (status === 'confirmed' || status === 'completed') {
    history.push({ status: 'confirmed', changedAt: confirmedAt })
  }
  if (status === 'completed') history.push({ status: 'completed', changedAt: end.toISOString() })
  if (status === 'cancelled') history.push({ status: 'cancelled', changedAt: confirmedAt })
  return history
}

export const DAYS_BACK = 180

export interface DemoInput {
  services: Service[]
  employees: Employee[]
  blocks: TimeBlock[]
}

export function generateDemoBookings(
  { services, employees, blocks }: DemoInput,
  now: Date,
  seed = 2026,
): Booking[] {
  const random = seededRandom(seed)
  const bookings: Booking[] = []
  const codes = new Set<string>()
  const today = toClinicDateKey(now)

  for (let offset = -DAYS_BACK; offset <= 14; offset++) {
    const date = addDaysToKey(today, offset)
    // "Teraz" dzień wcześniej - żeby algorytm pokazał wszystkie godziny dnia, także przeszłe.
    const dayBefore = clinicDateTime(addDaysToKey(date, -1), '00:00')

    for (const employee of employees) {
      const offered = services.filter((s) => s.active && employee.serviceIds.includes(s.id))
      if (offered.length === 0) continue
      const visits = 3 + Math.floor(random() * 5)

      for (let i = 0; i < visits; i++) {
        const service = pick(random, offered)
        const free = generateSlots({
          date,
          service,
          employees: [employee],
          bookings,
          blocks,
          now: dayBefore,
          minLeadMin: 0,
        })
        if (free.length === 0) break

        const slot = pick(random, free)
        const start = new Date(slot.start)
        const end = addMinutes(start, service.durationMin)
        const status = demoStatus(random, start, end, now)
        const bookedAt = subDays(start, 1 + Math.floor(random() * 10))
        const createdAt = bookedAt < now ? bookedAt : addHours(now, -1)
        const code = generateBookingCode(codes)
        codes.add(code)

        bookings.push({
          id: crypto.randomUUID(),
          code,
          serviceId: service.id,
          employeeId: employee.id,
          start: start.toISOString(),
          end: end.toISOString(),
          status,
          customer: demoCustomer(random),
          createdAt: createdAt.toISOString(),
          statusHistory: demoHistory(status, createdAt, end),
        })
      }
    }
  }
  return bookings.sort((a, b) => a.start.localeCompare(b.start))
}
