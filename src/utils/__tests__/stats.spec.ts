import { describe, it, expect } from 'vitest'
import { clinicDateTime } from '@/lib/dates'
import { seedEmployees, seedServices } from '@/mocks/seed'
import type { Booking, BookingStatus, TimeBlock } from '@/types/models'
import { availableMinutes, computeStats, percentChange, previousRange } from '../stats'

const kowalska = seedEmployees.find((e) => e.id === 'emp-kowalska')! // pn-czw 8-16, pt 8-14

let n = 0
function booking(date: string, start: string, end: string, extra: Partial<Booking> = {}): Booking {
  n += 1
  return {
    id: `b${n}`,
    code: `BK-AAAA${n}`,
    serviceId: 'svc-przeglad',
    employeeId: 'emp-kowalska',
    start: clinicDateTime(date, start).toISOString(),
    end: clinicDateTime(date, end).toISOString(),
    status: 'completed' as BookingStatus,
    customer: { name: 'X Y', email: 'x@example.com', phone: '600700800' },
    createdAt: '2026-10-01T00:00:00.000Z',
    statusHistory: [],
    ...extra,
  }
}

const block = (employeeId: string | null, date: string, start: string, end: string): TimeBlock => ({
  id: `blk-${date}-${start}`,
  employeeId,
  start: clinicDateTime(date, start).toISOString(),
  end: clinicDateTime(date, end).toISOString(),
  reason: 'other',
})

describe('availableMinutes', () => {
  it('godziny z grafiku: poniedziałek 8 h, piątek 6 h, sobota 0', () => {
    expect(availableMinutes(kowalska, '2026-11-02', [])).toBe(480)
    expect(availableMinutes(kowalska, '2026-11-06', [])).toBe(360)
    expect(availableMinutes(kowalska, '2026-11-07', [])).toBe(0)
  })

  it('odejmuje blokady osoby i gabinetu, nie licząc dwa razy tego samego czasu', () => {
    const blocks = [
      block('emp-kowalska', '2026-11-02', '12:00', '13:00'),
      block(null, '2026-11-02', '12:30', '14:00'), // nachodzi na poprzednią
      block('emp-wisniewski', '2026-11-02', '08:00', '16:00'), // cudza - bez wpływu
      block(null, '2026-11-02', '06:00', '08:30'), // częściowo przed pracą
    ]
    // 480 − (12:00-14:00 = 120) − (8:00-8:30 = 30) = 330
    expect(availableMinutes(kowalska, '2026-11-02', blocks)).toBe(330)
  })
})

describe('computeStats', () => {
  const services = seedServices
  const employees = [kowalska]
  const bookings = [
    booking('2026-11-02', '08:00', '08:30'), // przegląd 150 zł, zakończona
    booking('2026-11-02', '09:00', '09:45', { serviceId: 'svc-wypelnienie' }), // 300 zł "od"
    booking('2026-11-03', '10:00', '10:30', { status: 'cancelled' }),
    booking('2026-11-04', '10:00', '11:30', { serviceId: 'svc-kanalowe', status: 'confirmed' }),
    booking('2026-11-09', '10:00', '10:30'), // poza zakresem
  ]
  const stats = computeStats({
    bookings,
    services,
    employees,
    blocks: [],
    from: '2026-11-02',
    to: '2026-11-08',
  })

  it('liczy wizyty, odwołania i przychód tylko z zakończonych', () => {
    expect(stats.visits).toBe(3)
    expect(stats.completed).toBe(2)
    expect(stats.cancelled).toBe(1)
    expect(stats.cancellationRate).toBeCloseTo(1 / 4)
    expect(stats.revenueGrosze).toBe(150_00 + 300_00)
  })

  it('dzień po dniu - także dni bez wizyt; dni tygodnia od poniedziałku', () => {
    expect(stats.perDay).toHaveLength(7)
    expect(stats.perDay.slice(0, 3).map((d) => d.visits)).toEqual([2, 0, 1])
    expect(stats.perWeekday[0]).toMatchObject({ label: 'Poniedziałek', visits: 2 })
    expect(stats.perWeekday[6]).toMatchObject({ label: 'Niedziela', visits: 0 })
  })

  it('usługi malejąco wg liczby wizyt (bez odwołanych)', () => {
    expect(stats.perService.map((s) => [s.serviceId, s.visits])).toEqual([
      ['svc-kanalowe', 1],
      ['svc-przeglad', 1],
      ['svc-wypelnienie', 1],
    ])
  })

  it('obłożenie = zajęte minuty / minuty w grafiku', () => {
    // Pn-czw 4 x 480 + pt 360 = 2280 min; zajęte: 30 + 45 + 90 = 165 min.
    expect(stats.perEmployee[0]).toMatchObject({ bookedMin: 165, availableMin: 2280, visits: 3 })
    expect(stats.utilization).toBeCloseTo(165 / 2280)
  })

  it('pusty okres: zera i null tam, gdzie nie ma z czego liczyć procentów', () => {
    const empty = computeStats({
      bookings: [],
      services,
      employees: [],
      blocks: [],
      from: '2026-11-07',
      to: '2026-11-08',
    })
    expect(empty).toMatchObject({
      visits: 0,
      revenueGrosze: 0,
      cancellationRate: null,
      utilization: null,
    })
  })
})

describe('porównanie okresów', () => {
  it('previousRange: ten sam rozmiar tuż przed', () => {
    expect(previousRange('2026-11-02', '2026-11-08')).toEqual({
      from: '2026-10-26',
      to: '2026-11-01',
    })
    expect(previousRange('2026-11-01', '2026-11-30')).toEqual({
      from: '2026-10-02',
      to: '2026-10-31',
    })
  })

  it('percentChange', () => {
    expect(percentChange(12, 10)).toBeCloseTo(0.2)
    expect(percentChange(8, 10)).toBeCloseTo(-0.2)
    expect(percentChange(0, 0)).toBe(0)
    expect(percentChange(5, 0)).toBeNull()
  })
})
