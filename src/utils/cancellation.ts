import { subHours } from 'date-fns'
import type { Booking } from '@/types/models'
import { canTransition } from './transitions'

export const CANCEL_DEADLINE_HOURS = 24

export type CancelCheck =
  | { allowed: true; deadline: string }
  | { allowed: false; reason: 'status' | 'too-late'; deadline: string }

export function checkCustomerCancel(
  booking: Pick<Booking, 'status' | 'start'>,
  now: Date,
): CancelCheck {
  const deadline = subHours(new Date(booking.start), CANCEL_DEADLINE_HOURS)
  const deadlineIso = deadline.toISOString()
  if (!canTransition(booking.status, 'cancelled')) {
    return { allowed: false, reason: 'status', deadline: deadlineIso }
  }
  // Równo 24 h przed wizytą jeszcze można; minutę później już nie.
  if (now.getTime() > deadline.getTime()) {
    return { allowed: false, reason: 'too-late', deadline: deadlineIso }
  }
  return { allowed: true, deadline: deadlineIso }
}
