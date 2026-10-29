import { useScheduleStore } from '@/stores/schedule'
import { useServicesStore } from '@/stores/services'

export function useCatalogChanged() {
  const schedule = useScheduleStore()
  const services = useServicesStore()
  return () => {
    schedule.invalidate()
    services.invalidate()
  }
}
