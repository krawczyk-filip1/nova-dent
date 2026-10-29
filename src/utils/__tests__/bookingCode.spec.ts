import { describe, it, expect } from 'vitest'
import { generateBookingCode, isBookingCode, normalizeBookingCode } from '../bookingCode'

describe('kod rezerwacji', () => {
  it('ma format BK-XXXXXX i nie zawiera mylących znaków 0, O, 1, I', () => {
    for (let i = 0; i < 500; i++) {
      const code = generateBookingCode()
      expect(isBookingCode(code)).toBe(true)
      expect(code.slice(3)).not.toMatch(/[01OI]/)
    }
  })

  it('omija kody już zajęte', () => {
    const taken = new Set<string>()
    for (let i = 0; i < 200; i++) taken.add(generateBookingCode(taken))
    expect(taken.size).toBe(200)
  })

  it.each([
    ['bk-7f3k9q', 'BK-7F3K9Q'],
    ['7F3 K9Q', 'BK-7F3K9Q'],
    [' BK 7F3-K9Q ', 'BK-7F3K9Q'],
  ])('normalizuje %j -> %s', (input, expected) => {
    expect(normalizeBookingCode(input)).toBe(expected)
  })

  it.each(['BK-7F3K9', 'BK-7F3K9QQ', 'BK-0F3K9Q', 'XX-7F3K9Q'])('odrzuca %j', (code) => {
    expect(isBookingCode(code)).toBe(false)
  })
})
