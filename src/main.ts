import './assets/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import { installApiAuth } from './plugins/apiAuth'
import router from './router'

// Aplikacja nie ma prawdziwego backendu - zapytania /api/* obsługuje MSW w przeglądarce.
// Montujemy ją dopiero, gdy service worker jest gotowy, inaczej pierwsze zapytania by przepadły.
async function enableMocking() {
  const { worker } = await import('./mocks/browser')
  await worker.start({
    serviceWorker: { url: `${import.meta.env.BASE_URL}mockServiceWorker.js` },
    onUnhandledRequest: 'bypass',
    quiet: import.meta.env.PROD,
  })
}

enableMocking()
  // Gdy service worker nie ruszy (np. zablokowany w trybie prywatnym), i tak pokazujemy aplikację -
  // widoki wyświetlą wtedy swoje komunikaty o błędzie zamiast pustej białej strony.
  .catch((error: unknown) => console.error('Nie udało się uruchomić mock API (MSW).', error))
  .then(() => {
    const app = createApp(App)
    const pinia = createPinia()

    app.use(pinia)
    installApiAuth(pinia, router)
    app.use(router)

    app.mount('#app')
  })
