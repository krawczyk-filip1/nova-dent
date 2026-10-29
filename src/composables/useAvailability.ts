import { ref, toValue, watch, type MaybeRefOrGetter } from 'vue'
import { fetchAvailability, type AvailabilityQuery } from '@/api/public'
import type { LoadStatus } from '@/stores/services'
import type { TimeSlot } from '@/types/models'

/**
 * Wolne terminy dla zapytania, które może się zmieniać (inny lekarz, inny tydzień).
 * Pobiera ponownie przy każdej zmianie i ignoruje spóźnione odpowiedzi na stare zapytania -
 * inaczej szybkie klikanie mogłoby pokazać terminy poprzedniego lekarza.
 */
export function useAvailability(query: MaybeRefOrGetter<AvailabilityQuery | null>) {
  const slots = ref<TimeSlot[]>([])
  const status = ref<LoadStatus>('idle')
  const error = ref<string | null>(null)
  let requestId = 0

  async function load() {
    const q = toValue(query)
    if (!q) return
    const id = ++requestId
    status.value = 'loading'
    error.value = null
    try {
      const result = await fetchAvailability(q)
      if (id !== requestId) return // w międzyczasie poszło nowsze zapytanie
      slots.value = result
      status.value = 'ready'
    } catch (e) {
      if (id !== requestId) return
      error.value = e instanceof Error ? e.message : 'Nieznany błąd.'
      status.value = 'error'
    }
  }

  // Porównujemy treść zapytania, a nie obiekt - nowy obiekt z tymi samymi polami nie pobiera ponownie.
  watch(() => JSON.stringify(toValue(query)), load, { immediate: true })

  return { slots, status, error, reload: load }
}
