import { describe, it, expect } from 'vitest'
import { customerFormSchema, customerSchema } from '../customer'

const valid = { name: 'Jan Kowalski', email: 'jan@example.com', phone: '600700800' }

function errorFor(field: string, data: Record<string, unknown>) {
  const result = customerSchema.safeParse(data)
  return result.success ? undefined : result.error.flatten().fieldErrors[field as 'name']?.[0]
}

describe('customerSchema', () => {
  it('przyjmuje poprawne dane i je normalizuje', () => {
    const result = customerSchema.parse({
      name: '  Jan Kowalski ',
      email: ' Jan@Example.COM ',
      phone: '+48 600-700-800',
      notes: '   ',
    })
    expect(result).toEqual({
      name: 'Jan Kowalski',
      email: 'jan@example.com',
      phone: '+48600700800',
      notes: undefined,
    })
  })

  it.each([
    ['', 'Podaj imię i nazwisko.'],
    ['Jan', 'Podaj imię i nazwisko, np. Jan Kowalski.'],
    ['x '.repeat(41), 'Imię i nazwisko może mieć najwyżej 80 znaków.'],
  ])('imię i nazwisko %j -> %s', (name, message) => {
    expect(errorFor('name', { ...valid, name })).toBe(message)
  })

  it.each(['', 'jan', 'jan@', 'jan@example'])('odrzuca e-mail %j', (email) => {
    expect(errorFor('email', { ...valid, email })).toBeDefined()
  })

  it.each(['600 700 800', '600-700-800', '+48600700800', '+48 600 700 800'])(
    'przyjmuje telefon %j',
    (phone) => {
      expect(errorFor('phone', { ...valid, phone })).toBeUndefined()
    },
  )

  it.each(['60070080', '6007008001', '+49600700800', 'sześćset'])('odrzuca telefon %j', (phone) => {
    expect(errorFor('phone', { ...valid, phone })).toBe(
      'Numer powinien mieć 9 cyfr, np. 600 700 800.',
    )
  })

  it('uwagi najwyżej 500 znaków', () => {
    expect(errorFor('notes', { ...valid, notes: 'a'.repeat(500) })).toBeUndefined()
    expect(errorFor('notes', { ...valid, notes: 'a'.repeat(501) })).toBeDefined()
  })
})

describe('customerFormSchema', () => {
  it('wymaga zaznaczonej zgody', () => {
    expect(customerFormSchema.safeParse({ ...valid, consent: true }).success).toBe(true)
    const result = customerFormSchema.safeParse({ ...valid, consent: false })
    expect(result.success).toBe(false)
    expect(result.error?.flatten().fieldErrors.consent?.[0]).toContain('Zaznacz zgodę')
  })
})
