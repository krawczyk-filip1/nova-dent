<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { formatClinicDay, formatClinicTime, toClinicDateKey } from '@/lib/dates'
import type { Booking, Service } from '@/types/models'
import { formatPhone } from '@/utils/phone'
import { countLabel } from '@/utils/plural'

const props = defineProps<{
  conflicts: Booking[]
  services: Service[]
  cause: 'schedule' | 'block'
}>()

const where = computed(() =>
  props.cause === 'schedule' ? 'poza nowymi godzinami pracy' : 'w zablokowanym czasie',
)

const items = computed(() =>
  props.conflicts.map((b) => {
    const day = toClinicDateKey(b.start)
    return {
      id: b.id,
      day,
      when: `${formatClinicDay(day, 'EEEEEE d.MM')}, ${formatClinicTime(b.start)}`,
      who: b.customer.name,
      phone: b.customer.phone,
      service: props.services.find((s) => s.id === b.serviceId)?.name ?? '',
    }
  }),
)
</script>

<template>
  <div
    role="status"
    class="flex flex-col gap-3 rounded-2xl border-[1.5px] border-brand-600 bg-brand-100/50 p-4"
  >
    <p class="font-semibold text-brand-800">
      Zapisano, ale
      {{
        countLabel(conflicts.length, [
          'zaplanowana wizyta wypada',
          'zaplanowane wizyty wypadają',
          'zaplanowanych wizyt wypada',
        ])
      }}
      {{ where }}. Skontaktuj się z pacjentami, żeby je przełożyć lub odwołać.
    </p>
    <ul class="flex flex-col gap-1 text-sm">
      <li v-for="item in items" :key="item.id" class="flex flex-wrap gap-x-2">
        <RouterLink
          :to="{ name: 'admin-schedule', query: { widok: 'dzien', data: item.day } }"
          class="font-semibold text-brand-700 underline"
        >
          {{ item.when }}
        </RouterLink>
        <span>{{ item.who }} · {{ item.service }} ·</span>
        <a :href="`tel:${item.phone}`" class="underline">{{ formatPhone(item.phone) }}</a>
      </li>
    </ul>
  </div>
</template>
