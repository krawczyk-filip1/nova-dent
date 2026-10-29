import { HttpResponse } from 'msw'
import type { ValidationErrorBody } from '@/types/api'
import type { Booking } from '@/types/models'

export const errorResponse = (status: number, message: string) =>
  HttpResponse.json({ message }, { status })

export const validationError = (body: ValidationErrorBody) =>
  HttpResponse.json(body, { status: 422 })

export function fieldErrors(issues: { path: (string | number)[]; message: string }[]) {
  const result: Record<string, string> = {}
  for (const issue of issues) result[String(issue.path[0] ?? '_')] ??= issue.message
  return result
}

export const isUpcomingActive = (b: Booking, now: Date) =>
  (b.status === 'pending' || b.status === 'confirmed') && Date.parse(b.start) >= now.getTime()
