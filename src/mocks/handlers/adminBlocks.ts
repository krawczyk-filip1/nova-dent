import { delay, http, HttpResponse } from 'msw'
import { isDateKey, toClinicDateKey } from '@/lib/dates'
import { blockApiSchema } from '@/schemas/block'
import type { BlockSaveResponse } from '@/types/api'
import type { TimeBlock } from '@/types/models'
import { overlaps } from '@/utils/slots'
import { requireAdmin } from '../auth'
import { readDb, updateDb } from '../db'
import { fieldErrors, isUpcomingActive } from './shared'

const interval = (x: { start: string; end: string }) => ({
  start: Date.parse(x.start),
  end: Date.parse(x.end),
})

export const adminBlockHandlers = [
  http.get('/api/admin/blocks', async ({ request }) => {
    await delay()
    const denied = requireAdmin(request)
    if (denied) return denied
    const params = new URL(request.url).searchParams
    const from = params.get('from') ?? ''
    const to = params.get('to') ?? ''
    if (!isDateKey(from) || !isDateKey(to) || to < from) {
      return HttpResponse.json({ message: 'Niepoprawny zakres dat.' }, { status: 422 })
    }
    const blocks = readDb()
      .blocks.filter((b) => toClinicDateKey(b.end) >= from && toClinicDateKey(b.start) <= to)
      .sort((a, b) => a.start.localeCompare(b.start))
    return HttpResponse.json(blocks)
  }),

  http.post('/api/admin/blocks', async ({ request }) => {
    await delay()
    const denied = requireAdmin(request)
    if (denied) return denied
    const parsed = blockApiSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return HttpResponse.json(
        { message: 'Sprawdź dane blokady.', fieldErrors: fieldErrors(parsed.error.issues) },
        { status: 422 },
      )
    }
    const data = parsed.data
    if (data.employeeId && !readDb().employees.some((e) => e.id === data.employeeId)) {
      return HttpResponse.json({ message: 'Nie znaleziono osoby.' }, { status: 422 })
    }

    const now = new Date()
    const result = updateDb((db): BlockSaveResponse => {
      const block: TimeBlock = { id: crypto.randomUUID(), ...data }
      db.blocks.push(block)
      // Wizyty, które już są w tym czasie - blokada ich nie odwołuje, ale recepcja musi o nich wiedzieć.
      const conflicts = db.bookings.filter(
        (b) =>
          isUpcomingActive(b, now) &&
          (block.employeeId === null || b.employeeId === block.employeeId) &&
          overlaps(interval(b), interval(block)),
      )
      return { block, conflicts }
    })
    return HttpResponse.json(result, { status: 201 })
  }),

  http.delete<{ id: string }>('/api/admin/blocks/:id', async ({ request, params }) => {
    await delay()
    const denied = requireAdmin(request)
    if (denied) return denied
    if (!readDb().blocks.some((b) => b.id === params.id)) {
      return HttpResponse.json({ message: 'Nie znaleziono blokady.' }, { status: 404 })
    }
    updateDb((db) => {
      db.blocks = db.blocks.filter((b) => b.id !== params.id)
    })
    return new HttpResponse(null, { status: 204 })
  }),
]
