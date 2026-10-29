import { describe, it, expect } from 'vitest'
import { clinicDateTime, formatClinicTime } from '@/lib/dates'
import type { Booking, Employee, TimeBlock, WorkingHours } from '@/types/models'
import { generateSlots, overlaps, type GenerateSlotsInput } from '../slots'

// Czwartek 5.11.2026 - czas zimowy, Warszawa = UTC+1.
const DAY = '2026-11-05'
const SERVICE = { id: 'svc-test', durationMin: 60 }
const LONG_BEFORE = clinicDateTime('2026-11-01', '12:00')

const at = (time: string, date = DAY) => clinicDateTime(date, time).toISOString()

function employee(id: string, hours: WorkingHours | null, days: number[] = [4]): Employee {
  return {
    id,
    name: id,
    title: 'lek. dent.',
    serviceIds: [SERVICE.id],
    schedule: {
      0: days.includes(0) ? hours : null,
      1: days.includes(1) ? hours : null,
      2: days.includes(2) ? hours : null,
      3: days.includes(3) ? hours : null,
      4: days.includes(4) ? hours : null,
      5: days.includes(5) ? hours : null,
      6: days.includes(6) ? hours : null,
    },
  }
}

function booking(
  employeeId: string,
  start: string,
  end: string,
  status: Booking['status'] = 'confirmed',
) {
  return { employeeId, start: at(start), end: at(end), status }
}

function block(
  employeeId: string | null,
  start: string,
  end: string,
): Pick<TimeBlock, 'employeeId' | 'start' | 'end'> {
  return { employeeId, start: at(start), end: at(end) }
}

const anna = employee('anna', { start: '08:00', end: '16:00' })

function startTimes(overrides: Partial<GenerateSlotsInput> = {}): string[] {
  return generateSlots({
    date: DAY,
    service: SERVICE,
    employees: [anna],
    bookings: [],
    blocks: [],
    now: LONG_BEFORE,
    ...overrides,
  }).map((s) => formatClinicTime(s.start))
}

describe('overlaps', () => {
  it('stykające się przedziały nie nachodzą na siebie', () => {
    expect(overlaps({ start: 0, end: 10 }, { start: 10, end: 20 })).toBe(false)
  })
  it('wspólna choćby minuta to nakładanie', () => {
    expect(overlaps({ start: 0, end: 11 }, { start: 10, end: 20 })).toBe(true)
  })
  it('przedział w środku drugiego to nakładanie', () => {
    expect(overlaps({ start: 12, end: 15 }, { start: 10, end: 20 })).toBe(true)
  })
})

describe('generateSlots', () => {
  it('pusty dzień: starty co 15 min od początku pracy, ostatni tak, by usługa się zmieściła', () => {
    const times = startTimes()
    expect(times[0]).toBe('08:00')
    expect(times.at(-1)).toBe('15:00')
    expect(times).toHaveLength(7 * 4 + 1)
    expect(times.slice(0, 3)).toEqual(['08:00', '08:15', '08:30'])
  })

  it('koniec dnia: przy pracy do 17:00 wizyta godzinna o 16:00 tak, o 16:15 już nie', () => {
    const times = startTimes({ employees: [employee('anna', { start: '08:00', end: '17:00' })] })
    expect(times).toContain('16:00')
    expect(times).not.toContain('16:15')
  })

  it('zwraca start i koniec w UTC oraz osoby wolne o tej godzinie', () => {
    const [first] = generateSlots({
      date: DAY,
      service: SERVICE,
      employees: [anna],
      bookings: [],
      blocks: [],
      now: LONG_BEFORE,
    })
    expect(first).toEqual({
      start: '2026-11-05T07:00:00.000Z',
      end: '2026-11-05T08:00:00.000Z',
      employeeIds: ['anna'],
    })
  })

  it('wizyty stykające się z rezerwacją są dozwolone', () => {
    const times = startTimes({ bookings: [booking('anna', '09:00', '10:00')] })
    expect(times).toContain('08:00') // kończy się dokładnie o 9:00
    expect(times).toContain('10:00') // zaczyna się dokładnie o 10:00
    expect(times).not.toContain('08:15')
    expect(times).not.toContain('09:45')
  })

  it('częściowe nakładanie wyklucza termin', () => {
    const times = startTimes({ bookings: [booking('anna', '10:30', '10:45')] })
    expect(times).toContain('09:30')
    expect(times).not.toContain('09:45')
    expect(times).not.toContain('10:30')
    expect(times).toContain('10:45')
  })

  it('termin w całości wewnątrz dłuższej rezerwacji jest wykluczony', () => {
    const times = startTimes({ bookings: [booking('anna', '12:00', '14:00')] })
    expect(times).not.toContain('12:30')
    expect(times).toContain('11:00')
    expect(times).toContain('14:00')
  })

  it('anulowana rezerwacja zwalnia termin', () => {
    const times = startTimes({ bookings: [booking('anna', '09:00', '10:00', 'cancelled')] })
    expect(times).toContain('09:00')
  })

  it('oczekująca rezerwacja blokuje termin tak samo jak potwierdzona', () => {
    const times = startTimes({ bookings: [booking('anna', '09:00', '10:00', 'pending')] })
    expect(times).not.toContain('09:00')
  })

  it('rezerwacja innej osoby nie blokuje terminu', () => {
    const times = startTimes({ bookings: [booking('piotr', '09:00', '10:00')] })
    expect(times).toContain('09:00')
  })

  it('blokada osoby (np. urlop do południa) zabiera jej terminy', () => {
    const times = startTimes({ blocks: [block('anna', '08:00', '12:00')] })
    expect(times[0]).toBe('12:00')
  })

  it('blokada innej osoby nie zabiera terminów', () => {
    expect(startTimes({ blocks: [block('piotr', '08:00', '12:00')] })[0]).toBe('08:00')
  })

  it('blokada całego gabinetu (employeeId = null) zabiera terminy wszystkim', () => {
    const piotr = employee('piotr', { start: '08:00', end: '16:00' })
    const slots = generateSlots({
      date: DAY,
      service: SERVICE,
      employees: [anna, piotr],
      bookings: [],
      blocks: [block(null, '08:00', '16:00')],
      now: LONG_BEFORE,
    })
    expect(slots).toEqual([])
  })

  it('dzień wolny w grafiku - brak terminów', () => {
    expect(startTimes({ date: '2026-11-08' })).toEqual([]) // niedziela
  })

  it('osoba, która nie wykonuje usługi, nie ma terminów', () => {
    const other = { ...anna, serviceIds: ['svc-inna'] }
    expect(startTimes({ employees: [other] })).toEqual([])
  })

  it('dziś: bez przeszłości i z co najmniej godzinnym wyprzedzeniem', () => {
    const now = clinicDateTime(DAY, '10:07')
    const times = startTimes({ now })
    // 10:07 + 60 min = 11:07 -> pierwszy start z siatki co 15 min to 11:15.
    expect(times[0]).toBe('11:15')
  })

  it('dzień w przeszłości - brak terminów', () => {
    expect(startTimes({ now: clinicDateTime('2026-11-06', '08:00') })).toEqual([])
  })

  it('łączy osoby po godzinie startu i sortuje terminy', () => {
    const piotr = employee('piotr', { start: '07:00', end: '10:00' })
    const slots = generateSlots({
      date: DAY,
      service: SERVICE,
      employees: [anna, piotr],
      bookings: [booking('piotr', '08:00', '09:00')],
      blocks: [],
      now: LONG_BEFORE,
    })
    const byTime = Object.fromEntries(slots.map((s) => [formatClinicTime(s.start), s.employeeIds]))
    expect(byTime['07:00']).toEqual(['piotr'])
    expect(byTime['08:00']).toEqual(['anna']) // Piotr ma wtedy wizytę
    expect(byTime['09:00']).toEqual(['anna', 'piotr'])
    expect(slots.map((s) => s.start)).toEqual(slots.map((s) => s.start).sort())
  })

  describe('dni zmiany czasu', () => {
    const sundayShift = employee('anna', { start: '08:00', end: '10:00' }, [0])

    it('25.10.2026 (powrót do czasu zimowego): 8:00 w Warszawie to 07:00 UTC', () => {
      const slots = generateSlots({
        date: '2026-10-25',
        service: { id: SERVICE.id, durationMin: 30 },
        employees: [sundayShift],
        bookings: [],
        blocks: [],
        now: clinicDateTime('2026-10-20', '12:00'),
      })
      expect(slots[0]!.start).toBe('2026-10-25T07:00:00.000Z')
      expect(slots.map((s) => formatClinicTime(s.start))).toEqual([
        '08:00',
        '08:15',
        '08:30',
        '08:45',
        '09:00',
        '09:15',
        '09:30',
      ])
    })

    it('29.03.2026 (przejście na czas letni): 8:00 w Warszawie to 06:00 UTC', () => {
      const slots = generateSlots({
        date: '2026-03-29',
        service: { id: SERVICE.id, durationMin: 30 },
        employees: [sundayShift],
        bookings: [],
        blocks: [],
        now: clinicDateTime('2026-03-20', '12:00'),
      })
      expect(slots[0]!.start).toBe('2026-03-29T06:00:00.000Z')
      expect(slots).toHaveLength(7)
    })
  })
})
