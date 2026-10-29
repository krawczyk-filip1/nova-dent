import { TZDate, tz } from '@date-fns/tz'
import { format } from 'date-fns'
// Tylko polski - import z 'date-fns/locale' ładowałby w testach ~90 języków naraz.
import { pl } from 'date-fns/locale/pl'
import type { Weekday } from '@/types/models'

// Gabinet działa w Warszawie, niezależnie od strefy czasowej komputera pacjenta.
// Wszystkie obliczenia "który to dzień" i "która godzina" robimy w tej strefie,
// a do API i bazy zapisujemy chwile w czasie jako ISO w UTC.
export const CLINIC_TZ = 'Europe/Warsaw'

const inClinicTz = { in: tz(CLINIC_TZ) }

export type DateKey = string

const DATE_KEY = /^(\d{4})-(\d{2})-(\d{2})$/
const TIME = /^(\d{2}):(\d{2})$/

function parseDateKey(date: DateKey): [number, number, number] {
  const m = DATE_KEY.exec(date)
  if (!m) throw new Error(`Niepoprawna data: "${date}" (oczekiwano RRRR-MM-DD).`)
  return [Number(m[1]), Number(m[2]) - 1, Number(m[3])]
}

export function isDateKey(value: string): value is DateKey {
  if (!DATE_KEY.test(value)) return false
  const [y, mon, d] = parseDateKey(value)
  const check = new Date(Date.UTC(y, mon, d))
  // Odrzuca np. "2026-02-30", które Date "przewinąłby" na 2 marca.
  return check.getUTCFullYear() === y && check.getUTCMonth() === mon && check.getUTCDate() === d
}

export function clinicDateTime(date: DateKey, time: string): Date {
  const [y, mon, d] = parseDateKey(date)
  const t = TIME.exec(time)
  if (!t) throw new Error(`Niepoprawna godzina: "${time}" (oczekiwano GG:MM).`)
  return new Date(new TZDate(y, mon, d, Number(t[1]), Number(t[2]), CLINIC_TZ).getTime())
}

export function clinicWeekday(date: DateKey): Weekday {
  const [y, mon, d] = parseDateKey(date)
  return new TZDate(y, mon, d, 12, 0, CLINIC_TZ).getDay() as Weekday
}

export function toClinicDateKey(instant: Date | string): DateKey {
  return format(new Date(instant), 'yyyy-MM-dd', inClinicTz)
}

export function timeToMinutes(time: string): number {
  const t = TIME.exec(time)
  if (!t) throw new Error(`Niepoprawna godzina: "${time}" (oczekiwano GG:MM).`)
  return Number(t[1]) * 60 + Number(t[2])
}

export function clinicMinutesOfDay(instant: Date | string): number {
  return timeToMinutes(formatClinicTime(instant))
}

export function startOfClinicWeek(date: DateKey): DateKey {
  const offset = (clinicWeekday(date) + 6) % 7 // pn -> 0, wt -> 1 ... nd -> 6
  return addDaysToKey(date, -offset)
}

export function formatClinicTime(instant: Date | string): string {
  return format(new Date(instant), 'HH:mm', inClinicTz)
}

export function formatClinicDay(date: DateKey, pattern: string): string {
  // Południe zamiast północy - żaden wzorzec dnia nie "przeskoczy" na sąsiedni dzień.
  return format(clinicDateTime(date, '12:00'), pattern, { ...inClinicTz, locale: pl })
}

export function formatRelativeDay(date: DateKey, today: DateKey): string {
  if (date === today) return 'Dziś'
  if (date === addDaysToKey(today, 1)) return 'Jutro'
  return formatClinicDay(date, 'EEEEEE d.MM')
}

export function clinicToday(now: Date = new Date()): DateKey {
  return toClinicDateKey(now)
}

export function daysBetween(from: DateKey, to: DateKey): number {
  const [y1, m1, d1] = parseDateKey(from)
  const [y2, m2, d2] = parseDateKey(to)
  return Math.round((Date.UTC(y2, m2, d2) - Date.UTC(y1, m1, d1)) / 86_400_000)
}

/** Następny dzień kalendarzowy; liczony na dacie, nie na +24 h (doba zmiany czasu ma 23 lub 25 h). */
export function addDaysToKey(date: DateKey, days: number): DateKey {
  const [y, mon, d] = parseDateKey(date)
  const next = new Date(Date.UTC(y, mon, d + days))
  return next.toISOString().slice(0, 10)
}
