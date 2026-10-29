<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { deleteService, fetchAdminEmployees, fetchAdminServices, updateService } from '@/api/admin'
import ServiceFormModal from '@/components/admin/ServiceFormModal.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import { useCatalogChanged } from '@/composables/useCatalogChanged'
import type { LoadStatus } from '@/stores/services'
import type { Employee, Service } from '@/types/models'
import { formatDuration, formatServicePrice } from '@/utils/money'

const services = ref<Service[]>([])
const employees = ref<Employee[]>([])
const status = ref<LoadStatus>('idle')
const loadError = ref<string | null>(null)
const announcement = ref('')
const rowError = ref<string | null>(null)
const catalogChanged = useCatalogChanged()

async function load() {
  status.value = 'loading'
  try {
    ;[services.value, employees.value] = await Promise.all([
      fetchAdminServices(),
      fetchAdminEmployees(),
    ])
    status.value = 'ready'
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : 'Nieznany błąd.'
    status.value = 'error'
  }
}
onMounted(load)

const performers = (service: Service) =>
  employees.value.filter((e) => e.serviceIds.includes(service.id))

const editing = ref<Service | 'new' | null>(null)

async function onSaved(saved: Service) {
  const isNew = editing.value === 'new'
  editing.value = null
  announcement.value = isNew ? `Dodano usługę „${saved.name}”.` : `Zapisano „${saved.name}”.`
  catalogChanged()
  await load()
}

async function toggleActive(service: Service) {
  rowError.value = null
  try {
    const updated = await updateService(service.id, {
      name: service.name,
      description: service.description,
      durationMin: service.durationMin,
      priceGrosze: service.priceGrosze,
      priceFrom: service.priceFrom,
      active: !service.active,
      employeeIds: performers(service).map((e) => e.id),
    })
    services.value = services.value.map((s) => (s.id === updated.id ? updated : s))
    announcement.value = updated.active
      ? `„${updated.name}” jest znowu dostępna online.`
      : `„${updated.name}” zniknęła z oferty online.`
    catalogChanged()
  } catch (e) {
    rowError.value = e instanceof Error ? e.message : 'Nie udało się zmienić usługi.'
  }
}

const deleting = ref<Service | null>(null)
const deleteBusy = ref(false)
const deleteError = ref<string | null>(null)

function askDelete(service: Service) {
  deleting.value = service
  deleteError.value = null
}

async function confirmDelete() {
  if (!deleting.value) return
  deleteBusy.value = true
  try {
    await deleteService(deleting.value.id)
    announcement.value = `Usunięto „${deleting.value.name}”.`
    services.value = services.value.filter((s) => s.id !== deleting.value!.id)
    deleting.value = null
    catalogChanged()
  } catch (e) {
    deleteError.value = e instanceof Error ? e.message : 'Nie udało się usunąć usługi.'
  } finally {
    deleteBusy.value = false
  }
}
</script>

<template>
  <div class="flex flex-col gap-5">
    <header class="flex flex-wrap items-end justify-between gap-4">
      <div class="flex flex-col gap-1">
        <h1 class="text-3xl font-extrabold tracking-tight">Usługi</h1>
        <p class="text-ink-muted">Oferta widoczna dla pacjentów, czas trwania i ceny.</p>
      </div>
      <button
        type="button"
        class="min-h-11 rounded-full bg-brand-600 px-5 font-bold text-white hover:bg-brand-700"
        @click="editing = 'new'"
      >
        Dodaj usługę
      </button>
    </header>

    <p role="status" class="sr-only">{{ announcement }}</p>
    <p
      v-if="rowError"
      role="alert"
      class="rounded-2xl bg-brand-100 p-4 font-semibold text-brand-800"
    >
      {{ rowError }}
    </p>

    <p v-if="status === 'error'" role="alert" class="text-brand-800">
      Nie udało się pobrać usług. {{ loadError }}
    </p>
    <div
      v-else-if="status !== 'ready'"
      aria-busy="true"
      class="h-64 motion-safe:animate-pulse rounded-2xl bg-sand-100"
    />

    <div v-else class="overflow-x-auto rounded-2xl bg-white ring-1 ring-line">
      <table class="w-full min-w-[44rem] border-collapse text-left">
        <thead class="text-sm text-ink-muted">
          <tr class="border-b border-line">
            <th scope="col" class="px-4 py-3 font-semibold">Usługa</th>
            <th scope="col" class="px-4 py-3 font-semibold">Czas</th>
            <th scope="col" class="px-4 py-3 font-semibold">Cena</th>
            <th scope="col" class="px-4 py-3 font-semibold">Wykonuje</th>
            <th scope="col" class="px-4 py-3 font-semibold">Status</th>
            <th scope="col" class="px-4 py-3 font-semibold"><span class="sr-only">Akcje</span></th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="service in services"
            :key="service.id"
            class="border-b border-line last:border-b-0"
          >
            <th scope="row" class="px-4 py-3 align-top font-normal">
              <span class="block font-semibold" :class="service.active ? '' : 'text-ink-muted'">
                {{ service.name }}
              </span>
              <span class="block text-sm text-ink-muted">{{ service.description }}</span>
            </th>
            <td class="px-4 py-3 align-top whitespace-nowrap">
              {{ formatDuration(service.durationMin) }}
            </td>
            <td class="px-4 py-3 align-top whitespace-nowrap">{{ formatServicePrice(service) }}</td>
            <td class="px-4 py-3 align-top text-sm">
              {{
                performers(service)
                  .map((e) => e.name)
                  .join(', ') || '–'
              }}
            </td>
            <td class="px-4 py-3 align-top">
              <span
                class="inline-block rounded-full px-2.5 py-1 text-sm font-semibold"
                :class="service.active ? 'bg-ok-100 text-ok-800' : 'bg-sand-100 text-ink-muted'"
              >
                {{ service.active ? 'Aktywna' : 'Wyłączona' }}
              </span>
            </td>
            <td class="px-4 py-3 align-top">
              <div class="flex flex-wrap justify-end gap-x-3 gap-y-1 text-sm font-semibold">
                <button
                  type="button"
                  class="min-h-9 text-brand-700 underline"
                  :aria-label="`Edytuj: ${service.name}`"
                  @click="editing = service"
                >
                  Edytuj
                </button>
                <button
                  type="button"
                  class="min-h-9 text-brand-700 underline"
                  :aria-label="`${service.active ? 'Wyłącz' : 'Włącz'}: ${service.name}`"
                  @click="toggleActive(service)"
                >
                  {{ service.active ? 'Wyłącz' : 'Włącz' }}
                </button>
                <button
                  type="button"
                  class="min-h-9 text-brand-700 underline"
                  :aria-label="`Usuń: ${service.name}`"
                  @click="askDelete(service)"
                >
                  Usuń
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <ServiceFormModal
      v-if="editing"
      :key="editing === 'new' ? 'new' : editing.id"
      :service="editing === 'new' ? null : editing"
      :employees="employees"
      @close="editing = null"
      @saved="onSaved"
    />

    <ConfirmDialog
      :open="!!deleting"
      title="Usunąć usługę?"
      confirm-label="Tak, usuń"
      :busy="deleteBusy"
      :error="deleteError"
      @confirm="confirmDelete"
      @cancel="deleting = null"
    >
      <p>
        „{{ deleting?.name }}” zniknie z oferty i z panelu. Jeśli chcesz ją tylko czasowo ukryć
        przed pacjentami, użyj „Wyłącz”.
      </p>
    </ConfirmDialog>
  </div>
</template>
