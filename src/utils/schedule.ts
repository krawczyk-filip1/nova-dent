import { timeToMinutes } from '@/lib/dates'
import type { Employee, Weekday, WorkingHours } from '@/types/models'

export const WEEKDAYS: { day: Weekday; label: string }[] = [
  { day: 1, label: 'Poniedziałek' },
  { day: 2, label: 'Wtorek' },
  { day: 3, label: 'Środa' },
  { day: 4, label: 'Czwartek' },
  { day: 5, label: 'Piątek' },
  { day: 6, label: 'Sobota' },
  { day: 0, label: 'Niedziela' },
]

export const TIME_OPTIONS = Array.from({ length: (22 - 6) * 4 + 1 }, (_, i) => {
  const minutes = 6 * 60 + i * 15
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
})

export type WeekSchedule = Employee['schedule']

export function validateWeekSchedule(schedule: unknown): Partial<Record<Weekday, string>> {
  const errors: Partial<Record<Weekday, string>> = {}
  if (!schedule || typeof schedule !== 'object') {
    for (const { day } of WEEKDAYS) errors[day] = 'Brak godzin pracy.'
    return errors
  }
  for (const { day } of WEEKDAYS) {
    const hours = (schedule as Record<string, WorkingHours | null | undefined>)[day]
    if (hours === null) continue
    if (!hours || !TIME_OPTIONS.includes(hours.start) || !TIME_OPTIONS.includes(hours.end)) {
      errors[day] = 'Wybierz godziny z listy.'
    } else if (timeToMinutes(hours.end) - timeToMinutes(hours.start) < 60) {
      errors[day] = 'Koniec musi być co najmniej godzinę po początku.'
    }
  }
  return errors
}
