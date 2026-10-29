import { z } from 'zod'
import { isBookingCode, normalizeBookingCode } from '@/utils/bookingCode'
import { customerSchema } from './customer'

export const lookupSchema = z.object({
  code: z
    .string({ required_error: 'Podaj kod rezerwacji.' })
    .trim()
    .min(1, 'Podaj kod rezerwacji.')
    .transform(normalizeBookingCode)
    .refine(isBookingCode, 'Kod ma postać BK- i 6 znaków, np. BK-7F3K9Q.'),
  email: customerSchema.shape.email,
})
