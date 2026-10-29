import { z } from 'zod'

// Jeden schemat dla formularza (przeglądarka) i dla mock API (POST /api/bookings) -
// reguły i komunikaty nie mogą się rozjechać.

export const NOTES_MAX = 500

export const customerSchema = z.object({
  name: z
    .string({ required_error: 'Podaj imię i nazwisko.' })
    .trim()
    .min(1, 'Podaj imię i nazwisko.')
    .max(80, 'Imię i nazwisko może mieć najwyżej 80 znaków.')
    .regex(/\S+\s+\S+/, 'Podaj imię i nazwisko, np. Jan Kowalski.'),
  email: z
    .string({ required_error: 'Podaj adres e-mail.' })
    .trim()
    .min(1, 'Podaj adres e-mail.')
    .email('Sprawdź adres e-mail – powinien wyglądać jak jan@example.com.')
    .transform((v) => v.toLowerCase()),
  phone: z
    .string({ required_error: 'Podaj numer telefonu.' })
    .trim()
    .min(1, 'Podaj numer telefonu.')
    .transform((v) => v.replace(/[\s-]/g, ''))
    .pipe(z.string().regex(/^(\+48)?\d{9}$/, 'Numer powinien mieć 9 cyfr, np. 600 700 800.')),
  notes: z
    .string()
    .trim()
    .max(NOTES_MAX, `Uwagi mogą mieć najwyżej ${NOTES_MAX} znaków.`)
    .optional()
    .transform((v) => (v ? v : undefined)),
})

export const customerFormSchema = customerSchema.extend({
  consent: z.literal(true, {
    errorMap: () => ({ message: 'Zaznacz zgodę – bez niej nie możemy zapisać rezerwacji.' }),
  }),
})

export type CustomerInput = z.input<typeof customerSchema>
export type CustomerFormValues = z.input<typeof customerFormSchema>
