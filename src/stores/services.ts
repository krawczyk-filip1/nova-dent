import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { fetchServices } from '@/api/public'
import type { Service } from '@/types/models'

export type LoadStatus = 'idle' | 'loading' | 'ready' | 'error'

export const useServicesStore = defineStore('services', () => {
  const services = ref<Service[]>([])
  const status = ref<LoadStatus>('idle')
  const error = ref<string | null>(null)

  const byId = computed(() => new Map(services.value.map((s) => [s.id, s])))

  async function load({ force = false } = {}) {
    if (status.value === 'loading') return
    if (status.value === 'ready' && !force) return

    status.value = 'loading'
    error.value = null
    try {
      services.value = await fetchServices()
      status.value = 'ready'
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Nieznany błąd.'
      status.value = 'error'
    }
  }

  function getById(id: string): Service | undefined {
    return byId.value.get(id)
  }

  function invalidate() {
    status.value = 'idle'
  }

  return { services, status, error, load, getById, invalidate }
})
