<script setup lang="ts">
defineProps<{ name: string; size?: number }>()
</script>

<template>
  <svg
    :width="size ?? 22"
    :height="size ?? 22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.8"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <template v-if="name === 'tasks'">
      <path d="M9 5h10M9 12h10M9 19h10" />
      <path d="M4 5l1 1 1.5-1.5M4 12l1 1 1.5-1.5M4 19l1 1 1.5-1.5" />
    </template>
    <template v-else-if="name === 'calendar'">
      <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
      <path d="M3.5 9.5h17M8 3v4M16 3v4" />
    </template>
    <template v-else-if="name === 'notes'">
      <path d="M6 3.5h9l3.5 3.5V20.5H6z" />
      <path d="M15 3.5V7h3.5M9 12h6M9 16h6" />
    </template>
    <template v-else-if="name === 'journal'">
      <path d="M12 3.5a6 6 0 0 0-6 6c0 5 6 9.5 6 9.5s6-4.5 6-9.5a6 6 0 0 0-6-6z" />
      <path d="M12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z" />
    </template>
    <template v-else-if="name === 'plans'">
      <path d="M4 20V4M4 5.5h11l-2 3.5 2 3.5H4" />
    </template>
    <template v-else-if="name === 'seasons'">
      <path d="M7 4h10v4a5 5 0 0 1-10 0z" />
      <path d="M7 6H4v3c0 3 4 4 8 4s8-1 8-4V6h-3M12 13v5M8.5 21h7" />
    </template>
    <template v-else-if="name === 'settings'">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6L17 7M7 17l-1.4 1.4" />
    </template>
    <template v-else-if="name === 'guide'">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.8.4-1 .9-1 1.7M12 16.5v.5" />
    </template>
    <template v-else-if="name === 'user'">
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c1-4 3.5-6 7-6s6 2 7 6" />
    </template>
    <template v-else-if="name === 'close'">
      <path d="M6 6l12 12M18 6L6 18" />
    </template>
    <template v-else-if="name === 'compass'">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M15.5 8.5l-2 5-5 2 2-5z" />
    </template>
    <template v-else-if="name === 'plus'">
      <path d="M12 5v14M5 12h14" />
    </template>
  </svg>
</template>
