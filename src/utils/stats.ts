import {
  addDaysToKey,
  clinicDateTime,
  clinicWeekday,
  daysBetween,
  toClinicDateKey,
  type DateKey,
} from '@/lib/dates'
import type { Booking, Employee, Service, TimeBlock, Weekday } from '@/types/models'
import { employeeLabel } from './employees'
import { WEEKDAYS } from './schedule'
import { overlaps } from './slots'

export interface StatsInput {
  bookings: Booking[]
  services: Service[]
  employees: Employee[]
  blocks: TimeBlock[]
  from: DateKey
  to: DateKey
}

export interface PeriodStats {
  from: DateKey
  to: DateKey
  visits: number
  completed: number
  cancelled: number
  /** Odwołane / wszystkie zapisane w okresie; null, gdy nie było żadnej rezerwacji. */
  cancellationRate: number | null
  /** Suma cen zakończonych wizyt wg aktualnego cennika (dla cen "od" - kwota minimalna). */
  revenueGrosze: number
  /** Zajęte minuty / minuty w grafiku (po odjęciu blokad); null, gdy nikt nie pracował. */
  utilization: number | null
  perDay: { date: DateKey; visits: number }[]
  perWeekday: { weekday: Weekday; label: string; visits: number }[]
  perService: { serviceId: string; name: string; visits: number }[]
  perEmployee: {
    employeeId: string
    name: string
    visits: number
    bookedMin: number
    availableMin: number
    utilization: number | null
  }[]
}

const minutes = (start: string, end: string) => (Date.parse(end) - Date.parse(start)) / 60_000

export function availableMinutes(employee: Employee, date: DateKey, blocks: TimeBlock[]): number {
  const hours = employee.schedule[clinicWeekday(date)]
  if (!hours) return 0
  const work = {
    start: clinicDateTime(date, hours.start).getTime(),
    end: clinicDateTime(date, hours.end).getTime(),
  }
  // Odejmujemy części wspólne blokad z czasem pracy (blokady jednej osoby nie nakładają się w danych demo,
  // ale na wszelki wypadek scalamy je, żeby nie odjąć tego samego czasu dwa razy).
  const cuts = blocks
    .filter((b) => b.employeeId === null || b.employeeId === employee.id)
    .map((b) => ({ start: Date.parse(b.start), end: Date.parse(b.end) }))
    .filter((b) => overlaps(b, work))
    .map((b) => ({ start: Math.max(b.start, work.start), end: Math.min(b.end, work.end) }))
    .sort((a, b) => a.start - b.start)

  let blocked = 0
  let cursor = work.start
  for (const cut of cuts) {
    const start = Math.max(cut.start, cursor)
    if (cut.end > start) {
      blocked += cut.end - start
      cursor = cut.end
    }
  }
  return (work.end - work.start - blocked) / 60_000
}

export function computeStats({
  bookings,
  services,
  employees,
  blocks,
  from,
  to,
}: StatsInput): PeriodStats {
  const inRange = bookings.filter((b) => {
    const day = toClinicDateKey(b.start)
    return day >= from && day <= to
  })
  const active = inRange.filter((b) => b.status !== 'cancelled')
  const completed = inRange.filter((b) => b.status === 'completed')
  const cancelled = inRange.length - active.length
  const priceOf = (id: string) => services.find((s) => s.id === id)?.priceGrosze ?? 0

  const dayCount = daysBetween(from, to) + 1
  const days = Array.from({ length: dayCount }, (_, i) => addDaysToKey(from, i))
  const visitsByDay = new Map<DateKey, number>()
  for (const b of active) {
    const day = toClinicDateKey(b.start)
    visitsByDay.set(day, (visitsByDay.get(day) ?? 0) + 1)
  }

  const perEmployee = employees.map((employee) => {
    const own = active.filter((b) => b.employeeId === employee.id)
    const bookedMin = own.reduce((sum, b) => sum + minutes(b.start, b.end), 0)
    const availableMin = days.reduce((sum, d) => sum + availableMinutes(employee, d, blocks), 0)
    return {
      employeeId: employee.id,
      name: employeeLabel(employee),
      visits: own.length,
      bookedMin,
      availableMin,
      // Wizyta poza grafikiem może dać ponad 100% - na wykresie przycinamy do pełnego paska.
      utilization: availableMin > 0 ? bookedMin / availableMin : null,
    }
  })
  const totalBooked = perEmployee.reduce((s, e) => s + e.bookedMin, 0)
  const totalAvailable = perEmployee.reduce((s, e) => s + e.availableMin, 0)

  const serviceCounts = new Map<string, number>()
  for (const b of active) serviceCounts.set(b.serviceId, (serviceCounts.get(b.serviceId) ?? 0) + 1)

  return {
    from,
    to,
    visits: active.length,
    completed: completed.length,
    cancelled,
    cancellationRate: inRange.length > 0 ? cancelled / inRange.length : null,
    revenueGrosze: completed.reduce((sum, b) => sum + priceOf(b.serviceId), 0),
    utilization: totalAvailable > 0 ? totalBooked / totalAvailable : null,
    perDay: days.map((date) => ({ date, visits: visitsByDay.get(date) ?? 0 })),
    perWeekday: WEEKDAYS.map(({ day, label }) => ({
      weekday: day,
      label,
      visits: active.filter((b) => clinicWeekday(toClinicDateKey(b.start)) === day).length,
    })),
    perService: [...serviceCounts.entries()]
      .map(([serviceId, visits]) => ({
        serviceId,
        name: services.find((s) => s.id === serviceId)?.name ?? 'Usługa usunięta',
        visits,
      }))
      .sort((a, b) => b.visits - a.visits || a.name.localeCompare(b.name, 'pl')),
    perEmployee,
  }
}

export function previousRange(from: DateKey, to: DateKey): { from: DateKey; to: DateKey } {
  const length = daysBetween(from, to) + 1
  return { from: addDaysToKey(from, -length), to: addDaysToKey(from, -1) }
}

export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null
  return (current - previous) / previous
}
