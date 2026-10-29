import type { BookingStatus } from '@/types/models'

export const ALLOWED_TRANSITIONS: Record<BookingStatus, readonly BookingStatus[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
}

export function canTransition(from: BookingStatus, to: BookingStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to)
}

export const STATUS_LABELS: Record<BookingStatus, string> = {
  pending: 'Czeka na potwierdzenie gabinetu',
  confirmed: 'Potwierdzona',
  completed: 'Zakończona',
  cancelled: 'Odwołana',
}
