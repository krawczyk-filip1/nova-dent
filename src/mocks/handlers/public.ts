import { addMinutes } from 'date-fns'
import { delay, http, HttpResponse } from 'msw'
import { addDaysToKey, isDateKey, toClinicDateKey } from '@/lib/dates'
import { customerSchema } from '@/schemas/customer'
import { CLINIC } from '@/constants/clinic'
import type { CreateBookingRequest, PatientBooking, ValidationErrorBody } from '@/types/api'
import type { Booking, TimeSlot } from '@/types/models'
import { generateBookingCode, normalizeBookingCode } from '@/utils/bookingCode'
import { checkCustomerCancel } from '@/utils/cancellation'
import { employeeLabel } from '@/utils/employees'
import { generateSlots } from '@/utils/slots'
import { readDb, updateDb, type DbData } from '../db'

export const MAX_AVAILABILITY_DAYS = 62

const error = (status: number, message: string) => HttpResponse.json({ message }, { status })

const validationError = (body: ValidationErrorBody) => HttpResponse.json(body, { status: 422 })

// Jeden komunikat dla złego kodu i złego e-maila - inaczej dałoby się sprawdzać, które kody istnieją.
const NOT_FOUND_MESSAGE = 'Nie znaleźliśmy rezerwacji o tym kodzie dla tego adresu e-mail.'

function findPatientBooking(db: DbData, code: string, email: string): Booking | undefined {
  const normalizedCode = normalizeBookingCode(code)
  const normalizedEmail = email.trim().toLowerCase()
  return db.bookings.find((b) => b.code === normalizedCode && b.customer.email === normalizedEmail)
}

function toPatientBooking(db: DbData, booking: Booking, now: Date): PatientBooking {
  const service = db.services.find((s) => s.id === booking.serviceId)
  const employee = db.employees.find((e) => e.id === booking.employeeId)
  const cancel = checkCustomerCancel(booking, now)
  return {
    booking,
    serviceName: service?.name ?? 'Usługa usunięta z oferty',
    employeeName: employee ? employeeLabel(employee) : '–',
    canCancel: cancel.allowed,
    cancelDeadline: cancel.deadline,
  }
}

export const publicHandlers = [
  http.get('/api/services', async () => {
    await delay()
    const { services } = readDb()
    return HttpResponse.json(services.filter((s) => s.active))
  }),

  http.get('/api/employees', async ({ request }) => {
    await delay()
    const serviceId = new URL(request.url).searchParams.get('serviceId')
    const { employees } = readDb()
    const result = serviceId ? employees.filter((e) => e.serviceIds.includes(serviceId)) : employees
    return HttpResponse.json(result)
  }),

  http.get('/api/availability', async ({ request }) => {
    await delay()
    const params = new URL(request.url).searchParams
    const serviceId = params.get('serviceId') ?? ''
    const employeeId = params.get('employeeId') ?? 'any'
    const from = params.get('from') ?? ''
    const to = params.get('to') ?? ''

    if (!isDateKey(from) || !isDateKey(to) || to < from) {
      return error(422, 'Niepoprawny zakres dat.')
    }
    if (addDaysToKey(from, MAX_AVAILABILITY_DAYS - 1) < to) {
      return error(422, `Zakres może mieć najwyżej ${MAX_AVAILABILITY_DAYS} dni.`)
    }

    const db = readDb()
    const service = db.services.find((s) => s.id === serviceId && s.active)
    if (!service) return error(404, 'Nie znaleziono usługi.')

    let employees = db.employees.filter((e) => e.serviceIds.includes(service.id))
    if (employeeId !== 'any') {
      employees = employees.filter((e) => e.id === employeeId)
      if (employees.length === 0) return error(404, 'Ta osoba nie wykonuje wybranej usługi.')
    }

    const now = new Date()
    const slots: TimeSlot[] = []
    for (let date = from; date <= to; date = addDaysToKey(date, 1)) {
      slots.push(
        ...generateSlots({
          date,
          service,
          employees,
          bookings: db.bookings,
          blocks: db.blocks,
          now,
        }),
      )
    }
    return HttpResponse.json(slots)
  }),

  http.post('/api/bookings', async ({ request }) => {
    await delay()
    const body = (await request.json().catch(() => null)) as Partial<CreateBookingRequest> | null
    if (!body || typeof body !== 'object')
      return validationError({ message: 'Brak danych rezerwacji.' })

    const parsed = customerSchema.safeParse(body.customer)
    if (!parsed.success) {
      const fieldErrors = Object.fromEntries(
        Object.entries(parsed.error.flatten().fieldErrors).map(([field, messages]) => [
          field,
          messages?.[0] ?? 'Niepoprawna wartość.',
        ]),
      )
      return validationError({ message: 'Sprawdź dane pacjenta.', fieldErrors })
    }

    const db = readDb()
    const service = db.services.find((s) => s.id === body.serviceId && s.active)
    if (!service) return validationError({ message: 'Ta usługa nie jest dostępna online.' })
    const employee = db.employees.find(
      (e) => e.id === body.employeeId && e.serviceIds.includes(service.id),
    )
    if (!employee) return validationError({ message: 'Ta osoba nie wykonuje wybranej usługi.' })
    const start = new Date(body.start ?? '')
    if (Number.isNaN(start.getTime()))
      return validationError({ message: 'Niepoprawna godzina wizyty.' })

    // Ten sam algorytm co lista terminów - chroni przed
    // dwiema osobami, które w tej samej chwili kliknęły "Potwierdź" na ten sam termin.
    const startIso = start.toISOString()
    const stillFree = generateSlots({
      date: toClinicDateKey(start),
      service,
      employees: [employee],
      bookings: db.bookings,
      blocks: db.blocks,
      now: new Date(),
    }).some((slot) => slot.start === startIso)
    if (!stillFree) return error(409, 'Ten termin został właśnie zajęty. Wybierz inną godzinę.')

    const now = new Date().toISOString()
    const booking = updateDb((data) => {
      const created: Booking = {
        id: crypto.randomUUID(),
        code: generateBookingCode(new Set(data.bookings.map((b) => b.code))),
        serviceId: service.id,
        employeeId: employee.id,
        start: startIso,
        end: addMinutes(start, service.durationMin).toISOString(),
        status: 'pending',
        customer: parsed.data,
        createdAt: now,
        statusHistory: [{ status: 'pending', changedAt: now }],
      }
      data.bookings.push(created)
      return created
    })
    return HttpResponse.json(booking, { status: 201 })
  }),

  http.get('/api/bookings/lookup', async ({ request }) => {
    await delay()
    const params = new URL(request.url).searchParams
    const db = readDb()
    const booking = findPatientBooking(db, params.get('code') ?? '', params.get('email') ?? '')
    if (!booking) return error(404, NOT_FOUND_MESSAGE)
    return HttpResponse.json(toPatientBooking(db, booking, new Date()))
  }),

  http.post<{ code: string }>('/api/bookings/:code/cancel', async ({ request, params }) => {
    await delay()
    const body = (await request.json().catch(() => null)) as { email?: string } | null
    const now = new Date()
    const db = readDb()
    const booking = findPatientBooking(db, params.code, body?.email ?? '')
    if (!booking) return error(404, NOT_FOUND_MESSAGE)

    const check = checkCustomerCancel(booking, now)
    if (!check.allowed) {
      return error(
        409,
        check.reason === 'too-late'
          ? `Do wizyty zostało mniej niż 24 godziny – odwołaj ją telefonicznie: ${CLINIC.phoneDisplay}.`
          : 'Tej rezerwacji nie można już odwołać.',
      )
    }

    const updated = updateDb((data) => {
      const target = data.bookings.find((b) => b.id === booking.id)!
      target.status = 'cancelled'
      target.statusHistory.push({ status: 'cancelled', changedAt: now.toISOString() })
      return toPatientBooking(data, target, now)
    })
    return HttpResponse.json(updated)
  }),
]
