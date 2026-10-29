import { addMinutes } from 'date-fns'
import { clinicDateTime, clinicWeekday, type DateKey } from '@/lib/dates'
import type { Booking, Employee, Service, TimeBlock, TimeSlot } from '@/types/models'

export const SLOT_STEP_MIN = 15
export const MIN_LEAD_MIN = 60

export interface GenerateSlotsInput {
  date: DateKey
  service: Pick<Service, 'id' | 'durationMin'>
  employees: Employee[]
  bookings: Pick<Booking, 'employeeId' | 'start' | 'end' | 'status'>[]
  blocks: Pick<TimeBlock, 'employeeId' | 'start' | 'end'>[]
  now: Date
  stepMin?: number
  minLeadMin?: number
}

interface Interval {
  start: number
  end: number
}

/**
 * Czy dwa przedziały [start, end) na siebie nachodzą.
 * Stykające się (jedna wizyta kończy się o 10:00, druga zaczyna o 10:00) - NIE nachodzą.
 */
export function overlaps(a: Interval, b: Interval): boolean {
  return a.start < b.end && b.start < a.end
}

function toInterval(item: { start: string; end: string }): Interval {
  return { start: Date.parse(item.start), end: Date.parse(item.end) }
}

/**
 * Wolne terminy na jeden dzień. Kolejne kroki:
 * 1. godziny pracy osoby w tym dniu tygodnia,
 * 2. starty co `stepMin` minut; cała usługa musi skończyć się najpóźniej z końcem pracy,
 * 3. odrzucenie kolizji z rezerwacjami (poza anulowanymi) i blokadami (osoby lub całego gabinetu),
 * 4. odrzucenie terminów z przeszłości i z wyprzedzeniem krótszym niż `minLeadMin`,
 * 5. połączenie osób po godzinie startu - jeden slot może mieć kilku wolnych lekarzy.
 */
export function generateSlots({
  date,
  service,
  employees,
  bookings,
  blocks,
  now,
  stepMin = SLOT_STEP_MIN,
  minLeadMin = MIN_LEAD_MIN,
}: GenerateSlotsInput): TimeSlot[] {
  const weekday = clinicWeekday(date)
  const earliestStart = addMinutes(now, minLeadMin).getTime()

  const clinicBlocks = blocks.filter((b) => b.employeeId === null).map(toInterval)
  const byStart = new Map<number, string[]>()

  for (const employee of employees) {
    if (!employee.serviceIds.includes(service.id)) continue
    const hours = employee.schedule[weekday]
    if (!hours) continue

    const workStart = clinicDateTime(date, hours.start)
    const workEnd = clinicDateTime(date, hours.end).getTime()

    const busy: Interval[] = [
      ...bookings
        .filter((b) => b.employeeId === employee.id && b.status !== 'cancelled')
        .map(toInterval),
      ...blocks.filter((b) => b.employeeId === employee.id).map(toInterval),
      ...clinicBlocks,
    ]

    for (let start = workStart; ; start = addMinutes(start, stepMin)) {
      const slot = { start: start.getTime(), end: addMinutes(start, service.durationMin).getTime() }
      if (slot.end > workEnd) break
      if (slot.start < earliestStart) continue
      if (busy.some((b) => overlaps(slot, b))) continue

      const ids = byStart.get(slot.start)
      if (ids) ids.push(employee.id)
      else byStart.set(slot.start, [employee.id])
    }
  }

  return [...byStart.entries()]
    .sort(([a], [b]) => a - b)
    .map(([start, employeeIds]) => ({
      start: new Date(start).toISOString(),
      end: addMinutes(start, service.durationMin).toISOString(),
      employeeIds,
    }))
}
