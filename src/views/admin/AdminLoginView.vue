<script setup lang="ts">
import { nextTick, ref, useTemplateRef } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import { ApiError } from '@/api/client'
import BrandLogo from '@/components/ui/BrandLogo.vue'
import TextField from '@/components/ui/TextField.vue'
import { safeAdminRedirect } from '@/router/guards'
import { loginSchema } from '@/schemas/login'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const form = useTemplateRef<HTMLFormElement>('form')

const sessionExpired = route.query.wygasla === '1'
const loginError = ref<string | null>(null)

const { handleSubmit, errors, defineField, isSubmitting } = useForm({
  validationSchema: toTypedSchema(loginSchema),
  initialValues: { username: '', password: '' },
})
const lazyThenEager = (state: { errors: string[] }) => ({
  validateOnModelUpdate: state.errors.length > 0,
})
const [username, usernameAttrs] = defineField('username', lazyThenEager)
const [password, passwordAttrs] = defineField('password', lazyThenEager)

const onSubmit = handleSubmit(
  async (values) => {
    loginError.value = null
    try {
      await auth.login(values)
      await router.replace(safeAdminRedirect(route.query.powrot) ?? { name: 'admin-schedule' })
    } catch (e) {
      loginError.value =
        e instanceof ApiError && e.status === 401
          ? e.message
          : `Nie udało się zalogować. ${e instanceof Error ? e.message : ''}`
      password.value = ''
    }
  },
  async () => {
    await nextTick()
    form.value?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
  },
)
</script>

<template>
  <main class="flex min-h-dvh items-center justify-center bg-sand-100 p-4">
    <div class="flex w-full max-w-md flex-col gap-6 rounded-3xl bg-white p-6 sm:p-8">
      <RouterLink :to="{ name: 'services' }" class="self-start rounded-lg">
        <BrandLogo />
      </RouterLink>
      <div class="flex flex-col gap-1">
        <h1 class="text-2xl font-extrabold tracking-tight">Panel gabinetu</h1>
        <p class="text-ink-muted">Zaloguj się, żeby zarządzać grafikiem i rezerwacjami.</p>
      </div>

      <p v-if="sessionExpired && !loginError" role="status" class="rounded-2xl bg-sand-100 p-4">
        Sesja wygasła – zaloguj się ponownie, a wrócisz do miejsca, w którym przerwano pracę.
      </p>

      <form ref="form" novalidate class="flex flex-col gap-5" @submit="onSubmit">
        <TextField
          v-model="username"
          v-bind="usernameAttrs"
          label="Login"
          :error="errors.username"
          autocomplete="username"
          autocapitalize="none"
          spellcheck="false"
        />
        <TextField
          v-model="password"
          v-bind="passwordAttrs"
          label="Hasło"
          :error="errors.password"
          type="password"
          autocomplete="current-password"
        />
        <p
          v-if="loginError"
          role="alert"
          class="rounded-2xl bg-brand-100 p-4 font-semibold text-brand-800"
        >
          {{ loginError }}
        </p>
        <button
          type="submit"
          :disabled="isSubmitting"
          class="min-h-12 rounded-full bg-brand-600 px-7 font-bold text-white hover:bg-brand-700 disabled:cursor-wait disabled:opacity-60"
        >
          {{ isSubmitting ? 'Loguję…' : 'Zaloguj się' }}
        </button>
      </form>

      <p class="rounded-2xl border border-dashed border-line p-4 text-sm text-ink-muted">
        Wersja demonstracyjna – login <strong class="text-ink">admin</strong>, hasło
        <strong class="text-ink">admin</strong>.
      </p>
    </div>
  </main>
</template>
