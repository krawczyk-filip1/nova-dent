import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import type { VueWrapper } from '@vue/test-utils'
import { clinicDateTime } from '@/lib/dates'
import { readDb } from '@/mocks/db'
import { mountApp } from '@/test/app'
import { addBooking, signInAsAdmin } from '@/test/fixtures'

// Środa 4.11.2026, 11:58.
beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(clinicDateTime('2026-11-04', '11:58'))
  await signInAsAdmin()
})
afterEach(() => vi.useRealTimers())

const field = (root: VueWrapper | ReturnType<VueWrapper['get']>, label: string) => {
  const id = root
    .findAll('label')
    .find((l) => l.text() === label)!
    .attributes('for')
  return root.get(`#${id}`)
}
const button = (root: VueWrapper | ReturnType<VueWrapper['get']>, text: string) =>
  root.findAll('button').find((b) => b.text() === text)

describe('Usługi', () => {
  async function open() {
    const app = await mountApp('/admin/uslugi')
    await vi.waitFor(() => expect(app.wrapper.find('table').exists()).toBe(true))
    return app
  }

  it('dodanie usługi przez formularz w oknie', async () => {
    const { wrapper } = await open()
    await button(wrapper, 'Dodaj usługę')!.trigger('click')
    const dialog = wrapper.get('dialog[open]')

    await field(dialog, 'Nazwa').setValue('Lakowanie bruzd')
    await field(dialog, 'Cena (zł)').setValue('120')
    const marta = dialog
      .findAll('input[type="checkbox"]')
      .find((c) => c.element.closest('label')?.textContent?.includes('Zielińska'))!
    await marta.setValue(true)
    await dialog.get('form').trigger('submit')

    await vi.waitFor(() => expect(wrapper.get('table').text()).toContain('Lakowanie bruzd'))
    expect(wrapper.find('dialog[open]').exists()).toBe(false)
    expect(readDb().services.find((s) => s.name === 'Lakowanie bruzd')).toMatchObject({
      priceGrosze: 120_00,
      durationMin: 30,
      active: true,
    })
    expect(wrapper.get('[role="status"]').text()).toBe('Dodano usługę „Lakowanie bruzd”.')
    wrapper.unmount()
  })

  it('błędy formularza widać przy polach', async () => {
    const { wrapper } = await open()
    await button(wrapper, 'Dodaj usługę')!.trigger('click')
    const dialog = wrapper.get('dialog[open]')
    await field(dialog, 'Cena (zł)').setValue('abc')
    await dialog.get('form').trigger('submit')

    await vi.waitFor(() => expect(dialog.text()).toContain('Nazwa musi mieć co najmniej 3 znaki.'))
    expect(dialog.text()).toContain('Podaj cenę w złotych')

    await field(dialog, 'Nazwa').setValue('Lakowanie')
    await field(dialog, 'Cena (zł)').setValue('120')
    await dialog.get('form').trigger('submit')
    await vi.waitFor(() => expect(dialog.text()).toContain('Wybierz co najmniej jedną osobę'))
    expect(readDb().services.some((s) => s.name === 'Lakowanie')).toBe(false)
    wrapper.unmount()
  })

  it('edycja: formularz ma wypełnione pola, także cenę', async () => {
    const { wrapper } = await open()
    await wrapper.get('button[aria-label="Edytuj: Wybielanie nakładkowe"]').trigger('click')
    const dialog = wrapper.get('dialog[open]')
    expect((field(dialog, 'Nazwa').element as HTMLInputElement).value).toBe('Wybielanie nakładkowe')
    expect((field(dialog, 'Cena (zł)').element as HTMLInputElement).value).toBe('1200')
    expect((field(dialog, 'Czas trwania').element as HTMLSelectElement).value).toBe('60')

    await field(dialog, 'Cena (zł)').setValue('1099,99')
    await dialog.get('form').trigger('submit')
    await vi.waitFor(() =>
      expect(readDb().services.find((s) => s.id === 'svc-wybielanie')!.priceGrosze).toBe(109999),
    )
    wrapper.unmount()
  })

  it('wyłączenie i ponowne włączenie usługi', async () => {
    const { wrapper } = await open()
    await wrapper.get('button[aria-label="Wyłącz: Higienizacja"]').trigger('click')
    await vi.waitFor(() =>
      expect(wrapper.find('button[aria-label="Włącz: Higienizacja"]').exists()).toBe(true),
    )
    expect(readDb().services.find((s) => s.id === 'svc-higienizacja')!.active).toBe(false)
    wrapper.unmount()
  })

  it('usunięcie usługi z wizytami: wyjaśnienie w oknie potwierdzenia', async () => {
    addBooking({ date: '2026-11-05', start: '09:00', end: '09:30', serviceId: 'svc-przeglad' })
    const { wrapper } = await open()
    await wrapper.get('button[aria-label="Usuń: Przegląd i konsultacja"]').trigger('click')
    await button(wrapper, 'Tak, usuń')!.trigger('click')

    await vi.waitFor(() =>
      expect(wrapper.get('dialog[open] [role="alert"]').text()).toContain('Wyłącz ją'),
    )
    expect(readDb().services.some((s) => s.id === 'svc-przeglad')).toBe(true)
    wrapper.unmount()
  })
})

describe('Pracownicy', () => {
  it('zmiana godzin: "Zapisz" aktywne dopiero po zmianie, konflikty z wizytami na liście', async () => {
    addBooking({ date: '2026-11-05', start: '14:00', end: '14:30', name: 'Popołudniowy Pacjent' })
    const { wrapper } = await mountApp('/admin/pracownicy')
    await vi.waitFor(() => expect(wrapper.findAll('section form')).toHaveLength(3))
    const kowalska = wrapper.findAll('section').find((s) => s.text().includes('Anna Kowalska'))!
    const save = kowalska.findAll('button').find((b) => b.text() === 'Zapisz godziny')!
    expect(save.attributes('disabled')).toBeDefined()

    await kowalska.get('select[aria-label="Czwartek: do"]').setValue('12:00')
    expect(save.attributes('disabled')).toBeUndefined()
    await kowalska.get('form').trigger('submit')

    await vi.waitFor(() => expect(kowalska.text()).toContain('Popołudniowy Pacjent'))
    expect(kowalska.text()).toContain('poza nowymi godzinami pracy')
    expect(readDb().employees.find((e) => e.id === 'emp-kowalska')!.schedule[4]).toEqual({
      start: '08:00',
      end: '12:00',
    })
    wrapper.unmount()
  })

  it('godzina końca przed początkiem blokuje zapis i pokazuje błąd przy dniu', async () => {
    const { wrapper } = await mountApp('/admin/pracownicy')
    await vi.waitFor(() => expect(wrapper.findAll('section form')).toHaveLength(3))
    const kowalska = wrapper.findAll('section').find((s) => s.text().includes('Anna Kowalska'))!
    await kowalska.get('select[aria-label="Poniedziałek: do"]').setValue('07:00')
    expect(kowalska.text()).toContain('Koniec musi być co najmniej godzinę po początku.')
    expect(
      kowalska
        .findAll('button')
        .find((b) => b.text() === 'Zapisz godziny')!
        .attributes('disabled'),
    ).toBeDefined()
    wrapper.unmount()
  })
})

describe('Blokady', () => {
  it('dzień zamknięcia gabinetu: dodanie, konflikt, lista i usunięcie', async () => {
    addBooking({ date: '2026-11-11', start: '10:00', end: '10:30', name: 'Pacjent w Święto' })
    const { wrapper } = await mountApp('/admin/blokady')
    await vi.waitFor(() => expect(wrapper.text()).toContain('Brak blokad'))

    await field(wrapper, 'Od dnia').setValue('2026-11-11')
    await field(wrapper, 'Do dnia').setValue('2026-11-11')
    await field(wrapper, 'Powód').setValue('other')
    await field(wrapper, 'Notatka (opcjonalnie)').setValue('Święto Niepodległości')
    await wrapper.get('form').trigger('submit')

    await vi.waitFor(() => expect(wrapper.text()).toContain('Pacjent w Święto'))
    expect(wrapper.text()).toContain('w zablokowanym czasie')
    await vi.waitFor(() => expect(wrapper.text()).toContain('środa, 11 listopada (cały dzień)'))
    expect(wrapper.text()).toContain(
      'Cały gabinet · Inne (np. szkolenie, awaria) · Święto Niepodległości',
    )

    await wrapper
      .findAll('button')
      .find((b) => b.attributes('aria-label')?.startsWith('Usuń blokadę'))!
      .trigger('click')
    await button(wrapper, 'Tak, usuń')!.trigger('click')
    await vi.waitFor(() => expect(readDb().blocks).toHaveLength(0))
    wrapper.unmount()
  })
})
