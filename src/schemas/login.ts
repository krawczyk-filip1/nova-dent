import { z } from 'zod'

export const loginSchema = z.object({
  username: z.string({ required_error: 'Podaj login.' }).trim().min(1, 'Podaj login.'),
  // Hasła nie przycinamy - spacja może być jego częścią.
  password: z.string({ required_error: 'Podaj hasło.' }).min(1, 'Podaj hasło.'),
})
