import { z } from 'zod'

export const DURATION_OPTIONS = Array.from({ length: 16 }, (_, i) => (i + 1) * 15) // 15-240 min

const name = z
  .string({ required_error: 'Podaj nazwę usługi.' })
  .trim()
  .min(3, 'Nazwa musi mieć co najmniej 3 znaki.')
  .max(60, 'Nazwa może mieć najwyżej 60 znaków.')
const description = z.string().trim().max(200, 'Opis może mieć najwyżej 200 znaków.')
const durationMin = z
  .number({ invalid_type_error: 'Wybierz czas trwania.' })
  .int()
  .refine((v) => DURATION_OPTIONS.includes(v), 'Czas trwania: od 15 do 240 minut, co 15.')

const someoneIfActive = (s: { active: boolean; employeeIds: string[] }) =>
  !s.active || s.employeeIds.length > 0
const someoneIfActiveIssue = {
  message: 'Wybierz co najmniej jedną osobę albo wyłącz usługę.',
  path: ['employeeIds'],
}

export const serviceApiSchema = z
  .object({
    name,
    description,
    durationMin,
    priceGrosze: z.number().int().min(0, 'Cena nie może być ujemna.').max(10_000_00),
    priceFrom: z.boolean(),
    active: z.boolean(),
    employeeIds: z.array(z.string()),
  })
  .refine(someoneIfActive, someoneIfActiveIssue)

export type ServiceInput = z.output<typeof serviceApiSchema>

/**
 * Formularz: cena wpisywana w złotych jako tekst ("350", "99,50").
 * Schemat tylko sprawdza - nie zmienia kształtu danych. VeeValidate przepuszcza przez niego także
 * wartości początkowe, więc transformacja (np. price -> priceGrosze) wyczyściłaby pola formularza.
 * Zamiana na kształt API: `toServiceInput`.
 */
export const serviceFormSchema = z
  .object({
    name,
    description,
    durationMin,
    price: z
      .string({ required_error: 'Podaj cenę.' })
      .trim()
      .regex(/^\d{1,5}([.,]\d{1,2})?$/, 'Podaj cenę w złotych, np. 350 lub 99,50.'),
    priceFrom: z.boolean(),
    active: z.boolean(),
    employeeIds: z.array(z.string()),
  })
  .refine(someoneIfActive, someoneIfActiveIssue)

export type ServiceFormValues = z.output<typeof serviceFormSchema>

export function toServiceInput({ price, ...rest }: ServiceFormValues): ServiceInput {
  // "99,50" -> 9950 groszy; Math.round chroni przed 99.5 * 100 = 9949.999...
  return { ...rest, priceGrosze: Math.round(Number(price.replace(',', '.')) * 100) }
}

export function formatPriceInput(grosze: number): string {
  return String(grosze / 100).replace('.', ',')
}
