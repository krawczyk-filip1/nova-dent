import { afterAll, afterEach, beforeAll } from 'vitest'
import { configureApiAuth } from '@/api/client'
import { server } from './server'

// jsdom nie przewija strony - router przy zmianie trasy woła scrollTo, więc wyciszamy ostrzeżenie.
window.scrollTo = () => {}

// jsdom nie ma metod <dialog> (przeglądarki tak). Minimalny zamiennik: otwarcie = atrybut `open`,
// zamknięcie zdejmuje go i wysyła zdarzenie "close", jak robi to przeglądarka.
if (!HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
    this.open = true
  }
  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
    if (!this.open) return
    this.open = false
    this.dispatchEvent(new Event('close'))
  }
}

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  server.resetHandlers()
  localStorage.clear()
  sessionStorage.clear()
  configureApiAuth({ getToken: () => null, onUnauthorized: () => {} })
})
afterAll(() => server.close())
