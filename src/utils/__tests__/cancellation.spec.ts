import { describe, it, expect } from 'vitest'
import { clinicDateTime } from '@/lib/dates'
import { checkCustomerCancel } from '../cancellation'
import { ALLOWED_TRANSITIONS, canTransition } from '../transitions'

const start = clinicDateTime('2026-11-10', '10:00').toISOString()
const at = (date: string, time: string) => clinicDateTime(date, time)

describe('canTransition', () => {
  it.each([
    ['pending', 'confirmed', true],
    ['pending', 'cancelled', true],
    ['confirmed', 'completed', true],
    ['confirmed', 'cancelled', true],
    ['pending', 'completed', false], // nie da się zakończyć niepotwierdzonej
    ['confirmed', 'pending', false],
    ['cancelled', 'confirmed', false],
    ['completed', 'cancelled', false],
  ] as const)('%s -> %s: %s', (from, to, expected) => {
    expect(canTransition(from, to)).toBe(expected)
  })

  it('statusy końcowe nie mają przejść', () => {
    expect(ALLOWED_TRANSITIONS.completed).toEqual([])
    expect(ALLOWED_TRANSITIONS.cancelled).toEqual([])
  })
})

describe('checkCustomerCancel (24 h przed wizytą)', () => {
  it('termin graniczny to dokładnie 24 h przed początkiem wizyty', () => {
    const check = checkCustomerCancel({ status: 'pending', start }, at('2026-11-01', '12:00'))
    expect(check).toEqual({ allowed: true, deadline: at('2026-11-09', '10:00').toISOString() })
  })

  it('równo 24 h przed wizytą jeszcze można', () => {
    expect(
      checkCustomerCancel({ status: 'confirmed', start }, at('2026-11-09', '10:00')).allowed,
    ).toBe(true)
  })

  it('minutę później już nie - trzeba dzwonić', () => {
    expect(
      checkCustomerCancel({ status: 'confirmed', start }, at('2026-11-09', '10:01')),
    ).toMatchObject({
      allowed: false,
      reason: 'too-late',
    })
  })

  it('odwołanej ani zakończonej nie można odwołać', () => {
    const early = at('2026-11-01', '12:00')
    expect(checkCustomerCancel({ status: 'cancelled', start }, early)).toMatchObject({
      reason: 'status',
    })
    expect(checkCustomerCancel({ status: 'completed', start }, early)).toMatchObject({
      reason: 'status',
    })
  })
})
