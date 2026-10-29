import { describe, it, expect } from 'vitest'
import {
  addDaysToKey,
  clinicDateTime,
  clinicWeekday,
  formatClinicTime,
  isDateKey,
  toClinicDateKey,
} from '../dates'

describe('dates', () => {
  it('clinicDateTime uwzględnia czas letni i zimowy', () => {
    expect(clinicDateTime('2026-07-01', '08:00').toISOString()).toBe('2026-07-01T06:00:00.000Z')
    expect(clinicDateTime('2026-12-01', '08:00').toISOString()).toBe('2026-12-01T07:00:00.000Z')
  })

  it('toClinicDateKey liczy dzień w Warszawie, nie w UTC', () => {
    // 23:30 UTC 28.10 to 00:30 29.10 w Warszawie.
    expect(toClinicDateKey('2026-10-28T23:30:00.000Z')).toBe('2026-10-29')
    expect(toClinicDateKey('2026-10-28T22:59:00.000Z')).toBe('2026-10-28')
  })

  it('formatClinicTime pokazuje godzinę gabinetu', () => {
    expect(formatClinicTime('2026-10-29T07:15:00.000Z')).toBe('08:15')
  })

  it('clinicWeekday: 0 = niedziela', () => {
    expect(clinicWeekday('2026-10-25')).toBe(0)
    expect(clinicWeekday('2026-10-28')).toBe(3)
  })

  it('addDaysToKey przechodzi przez zmianę czasu i koniec miesiąca', () => {
    expect(addDaysToKey('2026-10-24', 1)).toBe('2026-10-25')
    expect(addDaysToKey('2026-10-25', 1)).toBe('2026-10-26')
    expect(addDaysToKey('2026-10-31', 1)).toBe('2026-11-01')
    expect(addDaysToKey('2026-03-01', -1)).toBe('2026-02-28')
  })

  it.each([
    ['2026-10-28', true],
    ['2026-02-30', false],
    ['2026-13-01', false],
    ['28.10.2026', false],
    ['', false],
  ])('isDateKey(%j) -> %s', (value, expected) => {
    expect(isDateKey(value)).toBe(expected)
  })
})
