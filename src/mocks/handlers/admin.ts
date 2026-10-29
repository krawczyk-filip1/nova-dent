import { delay, http, HttpResponse } from 'msw'
import { addDaysToKey, isDateKey, toClinicDateKey } from '@/lib/dates'
import type { StatsResponse } from '@/types/api'
import type { BookingStatus } from '@/types/models'
import { computeStats, previousRange } from '@/utils/stats'
import { canTransition, STATUS_LABELS } from '@/utils/transitions'
import { requireAdmin } from '../auth'
import { readDb, resetDb, updateDb } from '../db'

const error = (status: number, message: string) => HttpResponse.json({ message }, { status })

const STATUSES = Object.keys(STATUS_LABELS) as BookingStatus[]

export const adminHandlers = [
  http.get('/api/admin/bookings', async ({ request }) => {
    await delay()
    const denied = requireAdmin(request)
    if (denied) return denied

    const params = new URL(request.url).searchParams
    const from = params.get('from') ?? ''
    const to = params.get('to') ?? ''
    const employeeId = params.get('employeeId')
    if (!isDateKey(from) || !isDateKey(to) || to < from) {
      return error(422, 'Niepoprawny zakres dat.')
    }

    const bookings = readDb()
      .bookings.filter((b) => {
        const day = toClinicDateKey(b.start)
        return day >= from && day <= to && (!employeeId || b.employeeId === employeeId)
      })
      .sort((a, b) => a.start.localeCompare(b.start))
    return HttpResponse.json(bookings)
  }),

  http.patch<{ id: string }>('/api/admin/bookings/:id/status', async ({ request, params }) => {
    await delay()
    const denied = requireAdmin(request)
    if (denied) return denied

    const body = (await request.json().catch(() => null)) as { status?: string } | null
    const next = body?.status as BookingStatus | undefined
    if (!next || !STATUSES.includes(next)) return error(422, 'Nieznany status.')

    const now = new Date()
    const booking = readDb().bookings.find((b) => b.id === params.id)
    if (!booking) return error(404, 'Nie znaleziono rezerwacji.')
    if (!canTransition(booking.status, next)) {
      return error(
        422,
        `Nie można zmienić statusu z „${STATUS_LABELS[booking.status]}” na „${STATUS_LABELS[next]}”.`,
      )
    }
    if (next === 'completed' && Date.parse(booking.start) > now.getTime()) {
      return error(
        422,
        'Wizyty, która się jeszcze nie zaczęła, nie można oznaczyć jako zakończonej.',
      )
    }

    const updated = updateDb((data) => {
      const target = data.bookings.find((b) => b.id === booking.id)!
      target.status = next
      target.statusHistory.push({ status: next, changedAt: now.toISOString() })
      return target
    })
    return HttpResponse.json(updated)
  }),

  http.get('/api/admin/employees', async ({ request }) => {
    await delay()
    return requireAdmin(request) ?? HttpResponse.json(readDb().employees)
  }),

  http.get('/api/admin/services', async ({ request }) => {
    await delay()
    return requireAdmin(request) ?? HttpResponse.json(readDb().services)
  }),

  http.get('/api/admin/stats', async ({ request }) => {
    await delay()
    const denied = requireAdmin(request)
    if (denied) return denied
    const params = new URL(request.url).searchParams
    const from = params.get('from') ?? ''
    const to = params.get('to') ?? ''
    if (!isDateKey(from) || !isDateKey(to) || to < from || addDaysToKey(from, 365) < to) {
      return error(422, 'Niepoprawny zakres dat (najwyżej rok).')
    }
    const db = readDb()
    const body: StatsResponse = {
      current: computeStats({ ...db, from, to }),
      previous: computeStats({ ...db, ...previousRange(from, to) }),
    }
    return HttpResponse.json(body)
  }),

  http.post('/api/admin/reset-demo', async ({ request }) => {
    await delay()
    const denied = requireAdmin(request)
    if (denied) return denied
    resetDb()
    return new HttpResponse(null, { status: 204 })
  }),
]
