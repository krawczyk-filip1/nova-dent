import { z } from 'zod'
import { addDaysToKey, clinicDateTime, isDateKey } from '@/lib/dates'
import { TIME_OPTIONS } from '@/utils/schedule'

export const BLOCK_REASONS = {
  vacation: 'Urlop',
  break: 'Przerwa',
  other: 'Inne (np. szkolenie, awaria)',
} as const

const reason = z.enum(['vacation', 'break', 'other'])

export const blockApiSchema = z
  .object({
    employeeId: z.string().nullable(),
    start: z.string().datetime({ message: 'Niepoprawny początek.' }),
    end: z.string().datetime({ message: 'Niepoprawny koniec.' }),
    reason,
    note: z.string().trim().max(120, 'Notatka może mieć najwyżej 120 znaków.').optional(),
  })
  .refine((b) => Date.parse(b.end) > Date.parse(b.start), {
    message: 'Koniec musi być po początku.',
    path: ['end'],
  })

export type BlockInput = z.output<typeof blockApiSchema>

const dateKey = z.string({ required_error: 'Wybierz datę.' }).refine(isDateKey, 'Wybierz datę.')

export const blockFormSchema = z
  .object({
    employeeId: z.string(), // '' -> cały gabinet
    fromDate: dateKey,
    toDate: dateKey,
    allDay: z.boolean(),
    fromTime: z.string(),
    toTime: z.string(),
    reason,
    note: z.string().max(120, 'Notatka może mieć najwyżej 120 znaków.'),
  })
  .superRefine((v, ctx) => {
    if (isDateKey(v.fromDate) && isDateKey(v.toDate) && v.toDate < v.fromDate) {
      ctx.addIssue({
        code: 'custom',
        path: ['toDate'],
        message: 'Data końca nie może być przed datą początku.',
      })
    }
    if (!v.allDay) {
      if (!TIME_OPTIONS.includes(v.fromTime) || !TIME_OPTIONS.includes(v.toTime)) {
        ctx.addIssue({ code: 'custom', path: ['toTime'], message: 'Wybierz godziny z listy.' })
      } else if (v.fromDate === v.toDate && v.toTime <= v.fromTime) {
        ctx.addIssue({ code: 'custom', path: ['toTime'], message: 'Koniec musi być po początku.' })
      }
    }
  })

export type BlockFormValues = z.output<typeof blockFormSchema>

/** Cały dzień = od 00:00 pierwszego dnia do 00:00 dnia po ostatnim (koniec wyłącznie). */
export function toBlockInput(v: BlockFormValues): BlockInput {
  return {
    employeeId: v.employeeId || null,
    start: clinicDateTime(v.fromDate, v.allDay ? '00:00' : v.fromTime).toISOString(),
    end: v.allDay
      ? clinicDateTime(addDaysToKey(v.toDate, 1), '00:00').toISOString()
      : clinicDateTime(v.toDate, v.toTime).toISOString(),
    reason: v.reason,
    note: v.note.trim() || undefined,
  }
}
