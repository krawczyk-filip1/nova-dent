import { describe, it, expect } from 'vitest'
import { formatPhone } from '../phone'
import { formatRelativeDay } from '@/lib/dates'

describe('formatPhone', () => {
  it.each([
    ['600700800', '600 700 800'],
    ['+48600700800', '+48 600 700 800'],
    ['600 700 800', '600 700 800'], // nietypowy format zostaje bez zmian
    ['12345', '12345'],
  ])('%s -> %s', (input, expected) => {
    expect(formatPhone(input)).toBe(expected)
  })
})

describe('formatRelativeDay', () => {
  it('dziś, jutro, potem dzień tygodnia z datą', () => {
    expect(formatRelativeDay('2026-11-04', '2026-11-04')).toBe('Dziś')
    expect(formatRelativeDay('2026-11-05', '2026-11-04')).toBe('Jutro')
    expect(formatRelativeDay('2026-11-06', '2026-11-04')).toBe('pią 6.11')
  })
})
