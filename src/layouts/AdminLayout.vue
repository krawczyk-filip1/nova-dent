<script setup lang="ts">
import { ref } from 'vue'
import { RouterLink, RouterView, useRouter } from 'vue-router'
import { resetDemo } from '@/api/admin'
import BrandLogo from '@/components/ui/BrandLogo.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import SkipLink from '@/components/ui/SkipLink.vue'
import { useAuthStore } from '@/stores/auth'

const links = [
  { name: 'admin-schedule', label: 'Grafik' },
  { name: 'admin-services', label: 'Usługi' },
  { name: 'admin-employees', label: 'Pracownicy' },
  { name: 'admin-blocks', label: 'Blokady' },
  { name: 'admin-stats', label: 'Statystyki' },
] as const

const auth = useAuthStore()
const router = useRouter()
const loggingOut = ref(false)

async function logout() {
  loggingOut.value = true
  await auth.logout()
  await router.replace({ name: 'admin-login' })
}

const confirmingReset = ref(false)
const resetting = ref(false)
const resetError = ref<string | null>(null)

async function confirmReset() {
  resetting.value = true
  resetError.value = null
  try {
    await resetDemo()
    // Zmieniło się wszystko naraz (usługi, grafiki, rezerwacje) - najprościej i najpewniej
    // przeładować stronę, zamiast unieważniać każdy store z osobna. Sesja admina zostaje.
    window.location.reload()
  } catch (e) {
    resetError.value = e instanceof Error ? e.message : 'Nie udało się przywrócić danych.'
    resetting.value = false
  }
}
</script>

<template>
  <SkipLink />
  <div class="flex min-h-dvh flex-wrap bg-sand-50">
    <aside
      class="flex w-full flex-col gap-6 border-b border-line bg-white p-4 lg:min-h-dvh lg:w-60 lg:border-r lg:border-b-0"
    >
      <div>
        <RouterLink :to="{ name: 'admin-schedule' }" class="block rounded-lg">
          <BrandLogo />
        </RouterLink>
        <p class="mt-1 text-sm text-ink-soft">Panel gabinetu</p>
      </div>
      <nav aria-label="Panel" class="flex flex-wrap gap-1 lg:flex-col">
        <RouterLink
          v-for="link in links"
          :key="link.name"
          :to="{ name: link.name }"
          class="rounded-lg px-3 py-2.5 font-medium hover:bg-sand-100"
          active-class="bg-brand-100 text-brand-800"
        >
          {{ link.label }}
        </RouterLink>
      </nav>
      <div
        class="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm lg:mt-auto lg:flex-col lg:items-start"
      >
        <span class="text-ink-muted">
          Zalogowano: <strong class="text-ink">{{ auth.userName }}</strong>
        </span>
        <button
          type="button"
          :disabled="loggingOut"
          class="min-h-11 rounded-lg px-3 font-semibold text-brand-700 hover:bg-brand-100"
          @click="logout"
        >
          Wyloguj
        </button>
        <RouterLink :to="{ name: 'services' }" class="px-3 text-ink-muted underline">
          Strona dla pacjentów
        </RouterLink>
        <button
          type="button"
          class="min-h-11 rounded-lg px-3 text-left text-ink-muted underline hover:bg-sand-100"
          @click="((confirmingReset = true), (resetError = null))"
        >
          Przywróć dane demo
        </button>
      </div>
    </aside>

    <ConfirmDialog
      :open="confirmingReset"
      title="Przywrócić dane demo?"
      confirm-label="Tak, przywróć"
      :busy="resetting"
      :error="resetError"
      @confirm="confirmReset"
      @cancel="confirmingReset = false"
    >
      <p>
        Usługi, godziny pracy, blokady i wszystkie rezerwacje wrócą do stanu początkowego, a wizyty
        demo powstaną na nowo wokół dzisiejszej daty. Twoje zmiany przepadną.
      </p>
    </ConfirmDialog>

    <main id="tresc" tabindex="-1" class="min-w-0 flex-[999_1_560px] p-4 outline-none sm:p-8">
      <RouterView />
    </main>
  </div>
</template>
