<script setup lang="ts">
defineProps<{ current: 1 | 2 | 3 }>()

const steps = ['Termin', 'Twoje dane', 'Podsumowanie'] as const
</script>

<template>
  <nav aria-label="Etapy rezerwacji">
    <ol class="flex flex-wrap gap-2 text-sm font-semibold">
      <li
        v-for="(label, index) in steps"
        :key="label"
        :aria-current="index + 1 === current ? 'step' : undefined"
        class="rounded-full px-3 py-1.5"
        :class="
          index + 1 === current
            ? 'bg-brand-600 text-white'
            : index + 1 < current
              ? 'bg-brand-100 text-brand-800'
              : 'bg-sand-100 text-ink-muted'
        "
      >
        {{ index + 1 }}. {{ label }}
      </li>
    </ol>
  </nav>
</template>
