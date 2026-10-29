import { describe, it, expect } from 'vitest'
import { seedEmployees } from '@/mocks/seed'
import { validateWeekSchedule } from '@/utils/schedule'
import { blockFormSchema, toBlockInput, type BlockFormValues } from '../block'
import {
  formatPriceInput,
  serviceFormSchema,
  toServiceInput,
  type ServiceFormValues,
} from '../service'

const service: ServiceFormValues = {
  name: 'Lakowanie',
  description: '',
  durationMin: 30,
  price: '99,50',
  priceFrom: false,
  active: true,
  employeeIds: ['emp-kowalska'],
}

const errorsOf = (result: {
  success: boolean
  error?: { flatten: () => { fieldErrors: object } }
}) => (result.success ? {} : result.error!.flatten().fieldErrors)

describe('schematy formularzy nie zmieniają kształtu danych', () => {
  // VeeValidate przepuszcza przez schemat wartości początkowe - transformacja wyczyściłaby pola.
  it('poprawne wartości wychodzą z tymi samymi kluczami', () => {
    expect(Object.keys(serviceFormSchema.parse(service)).sort()).toEqual(
      Object.keys(service).sort(),
    )
    const block: BlockFormValues = {
      employeeId: '',
      fromDate: '2026-11-09',
      toDate: '2026-11-09',
      allDay: true,
      fromTime: '12:00',
      toTime: '13:00',
      reason: 'vacation',
      note: '',
    }
    expect(blockFormSchema.parse(block)).toEqual(block)
  })
})

describe('usługa', () => {
  it('toServiceInput: cena w złotych -> grosze', () => {
    expect(toServiceInput(service)).toMatchObject({ priceGrosze: 9950, durationMin: 30 })
    expect(toServiceInput({ ...service, price: '1200' }).priceGrosze).toBe(120000)
    expect(toServiceInput({ ...service, price: '0.1' }).priceGrosze).toBe(10)
    expect(toServiceInput(service)).not.toHaveProperty('price')
  })

  it('formatPriceInput: grosze -> tekst do pola, z przecinkiem', () => {
    expect(formatPriceInput(9950)).toBe('99,5')
    expect(formatPriceInput(35000)).toBe('350')
  })

  it.each(['', 'abc', '12,345', '-5', '1 200'])('odrzuca cenę %j', (price) => {
    expect(errorsOf(serviceFormSchema.safeParse({ ...service, price }))).toHaveProperty('price')
  })

  it('czas trwania tylko z siatki co 15 minut', () => {
    expect(errorsOf(serviceFormSchema.safeParse({ ...service, durationMin: 20 }))).toHaveProperty(
      'durationMin',
    )
  })

  it('aktywna usługa musi mieć kogoś, kto ją wykonuje; wyłączona - nie', () => {
    expect(errorsOf(serviceFormSchema.safeParse({ ...service, employeeIds: [] }))).toHaveProperty(
      'employeeIds',
    )
    expect(
      serviceFormSchema.safeParse({ ...service, employeeIds: [], active: false }).success,
    ).toBe(true)
  })
})

describe('blokada', () => {
  const base: BlockFormValues = {
    employeeId: '',
    fromDate: '2026-11-09',
    toDate: '2026-11-11',
    allDay: true,
    fromTime: '08:00',
    toTime: '16:00',
    reason: 'vacation',
    note: '',
  }

  it('całe dni: od północy pierwszego dnia do północy po ostatnim; pusty employeeId = cały gabinet', () => {
    expect(toBlockInput(base)).toEqual({
      employeeId: null,
      start: '2026-11-08T23:00:00.000Z',
      end: '2026-11-11T23:00:00.000Z',
      reason: 'vacation',
      note: undefined,
    })
  })

  it('godziny w czasie gabinetu', () => {
    expect(
      toBlockInput({
        ...base,
        employeeId: 'emp-kowalska',
        toDate: '2026-11-09',
        allDay: false,
        fromTime: '12:00',
        toTime: '13:00',
        reason: 'break',
        note: '  przerwa  ',
      }),
    ).toMatchObject({
      employeeId: 'emp-kowalska',
      start: '2026-11-09T11:00:00.000Z',
      end: '2026-11-09T12:00:00.000Z',
      note: 'przerwa',
    })
  })

  it('koniec przed początkiem - błąd przy właściwym polu', () => {
    expect(errorsOf(blockFormSchema.safeParse({ ...base, toDate: '2026-11-01' }))).toHaveProperty(
      'toDate',
    )
    expect(
      errorsOf(
        blockFormSchema.safeParse({
          ...base,
          toDate: base.fromDate,
          allDay: false,
          fromTime: '13:00',
          toTime: '12:00',
        }),
      ),
    ).toHaveProperty('toTime')
  })
})

describe('validateWeekSchedule', () => {
  it('grafiki z danych demo są poprawne', () => {
    for (const e of seedEmployees) expect(validateWeekSchedule(e.schedule)).toEqual({})
  })

  it('zgłasza dzień z końcem przed początkiem albo godziną spoza listy', () => {
    const schedule = {
      ...seedEmployees[0]!.schedule,
      1: { start: '16:00', end: '08:00' },
      2: { start: '08:07', end: '16:00' },
    }
    expect(validateWeekSchedule(schedule)).toEqual({
      1: 'Koniec musi być co najmniej godzinę po początku.',
      2: 'Wybierz godziny z listy.',
    })
  })
})
