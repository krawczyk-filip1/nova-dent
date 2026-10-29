import { delay, http, HttpResponse } from 'msw'
import { clinicWeekday, timeToMinutes, clinicMinutesOfDay, toClinicDateKey } from '@/lib/dates'
import { serviceApiSchema } from '@/schemas/service'
import type { ScheduleSaveResponse } from '@/types/api'
import type { Employee, Service } from '@/types/models'
import { validateWeekSchedule, type WeekSchedule } from '@/utils/schedule'
import { requireAdmin } from '../auth'
import { readDb, updateDb, type DbData } from '../db'
import { errorResponse as error, fieldErrors, isUpcomingActive, validationError } from './shared'

function assignService(db: DbData, serviceId: string, employeeIds: string[]) {
  for (const employee of db.employees) {
    const has = employee.serviceIds.includes(serviceId)
    const should = employeeIds.includes(employee.id)
    if (should && !has) employee.serviceIds.push(serviceId)
    if (!should && has) employee.serviceIds = employee.serviceIds.filter((id) => id !== serviceId)
  }
}

function slugId(name: string, taken: Set<string>): string {
  const base =
    'svc-' +
    name
      .toLowerCase()
      .replace(/ł/g, 'l')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
  let id = base
  for (let i = 2; taken.has(id); i++) id = `${base}-${i}`
  return id
}

export const adminCatalogHandlers = [
  http.post('/api/admin/services', async ({ request }) => {
    await delay()
    const denied = requireAdmin(request)
    if (denied) return denied
    const parsed = serviceApiSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return validationError({
        message: 'Sprawdź dane usługi.',
        fieldErrors: fieldErrors(parsed.error.issues),
      })
    }
    const { employeeIds, ...data } = parsed.data
    const service = updateDb((db) => {
      const created: Service = {
        id: slugId(data.name, new Set(db.services.map((s) => s.id))),
        ...data,
      }
      db.services.push(created)
      assignService(db, created.id, employeeIds)
      return created
    })
    return HttpResponse.json(service, { status: 201 })
  }),

  http.put<{ id: string }>('/api/admin/services/:id', async ({ request, params }) => {
    await delay()
    const denied = requireAdmin(request)
    if (denied) return denied
    const parsed = serviceApiSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return validationError({
        message: 'Sprawdź dane usługi.',
        fieldErrors: fieldErrors(parsed.error.issues),
      })
    }
    if (!readDb().services.some((s) => s.id === params.id))
      return error(404, 'Nie znaleziono usługi.')
    const { employeeIds, ...data } = parsed.data
    // Zmiana czasu trwania nie przesuwa istniejących wizyt - dotyczy tylko nowych rezerwacji.
    const service = updateDb((db) => {
      const target = db.services.find((s) => s.id === params.id)!
      Object.assign(target, data)
      assignService(db, target.id, employeeIds)
      return target
    })
    return HttpResponse.json(service)
  }),

  http.delete<{ id: string }>('/api/admin/services/:id', async ({ request, params }) => {
    await delay()
    const denied = requireAdmin(request)
    if (denied) return denied
    const db = readDb()
    if (!db.services.some((s) => s.id === params.id)) return error(404, 'Nie znaleziono usługi.')
    // Usługa z historią wizyt zostaje (statystyki, "Moja rezerwacja") - można ją tylko wyłączyć.
    if (db.bookings.some((b) => b.serviceId === params.id)) {
      return error(
        409,
        'Tej usługi nie można usunąć, bo ma zapisane wizyty. Wyłącz ją – zniknie z oferty, a historia zostanie.',
      )
    }
    updateDb((data) => {
      data.services = data.services.filter((s) => s.id !== params.id)
      assignService(data, params.id, [])
    })
    return new HttpResponse(null, { status: 204 })
  }),

  http.put<{ id: string }>('/api/admin/employees/:id/schedule', async ({ request, params }) => {
    await delay()
    const denied = requireAdmin(request)
    if (denied) return denied
    const body = (await request.json().catch(() => null)) as { schedule?: WeekSchedule } | null
    const errors = validateWeekSchedule(body?.schedule)
    if (Object.keys(errors).length > 0) {
      return validationError({
        message: 'Sprawdź godziny pracy.',
        fieldErrors: Object.fromEntries(Object.entries(errors)),
      })
    }
    if (!readDb().employees.some((e) => e.id === params.id))
      return error(404, 'Nie znaleziono osoby.')

    const now = new Date()
    const result = updateDb((db): ScheduleSaveResponse => {
      const employee = db.employees.find((e) => e.id === params.id) as Employee
      employee.schedule = body!.schedule!
      const conflicts = db.bookings.filter((b) => {
        if (b.employeeId !== employee.id || !isUpcomingActive(b, now)) return false
        const hours = employee.schedule[clinicWeekday(toClinicDateKey(b.start))]
        if (!hours) return true
        return (
          clinicMinutesOfDay(b.start) < timeToMinutes(hours.start) ||
          clinicMinutesOfDay(b.end) > timeToMinutes(hours.end)
        )
      })
      return { employee, conflicts }
    })
    return HttpResponse.json(result)
  }),
]
