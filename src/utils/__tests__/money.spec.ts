import { describe, it, expect } from 'vitest'
import { formatDuration, formatPrice, formatServicePrice } from '../money'

// Intl wstawia twardą spację (U+00A0), więc porównujemy po zamianie na zwykłą.
const plain = (s: string) => s.replace(/ /g, ' ')

describe('formatPrice', () => {
  it.each([
    [150_00, '150 zł'],
    [123_45, '123,45 zł'],
    [0, '0 zł'],
    [1200_00, '1200 zł'],
    [12000_00, '12 000 zł'],
  ])('%i gr -> %s', (grosze, expected) => {
    expect(plain(formatPrice(grosze))).toBe(expected)
  })
})

describe('formatServicePrice', () => {
  it('dodaje "od" dla ceny orientacyjnej', () => {
    expect(plain(formatServicePrice({ priceGrosze: 300_00, priceFrom: true }))).toBe('od 300 zł')
    expect(plain(formatServicePrice({ priceGrosze: 300_00, priceFrom: false }))).toBe('300 zł')
  })
})

describe('formatDuration', () => {
  it.each([
    [15, '15 min'],
    [60, '1 h'],
    [90, '1 h 30 min'],
    [120, '2 h'],
  ])('%i -> %s', (minutes, expected) => {
    expect(formatDuration(minutes)).toBe(expected)
  })
})
