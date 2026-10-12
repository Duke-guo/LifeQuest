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
    <template v-if="name === 'home'">
      <path d="M3.5 10.5 12 3.5l8.5 7" />
      <path d="M5.5 9.5V20.5h13V9.5" />
      <path d="M10 20.5v-6h4v6" />
    </template>
    <template v-else-if="name === 'back'">
      <path d="M15 5.5 8.5 12l6.5 6.5" />
    </template>
    <template v-else-if="name === 'tasks'">
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
    <template v-else-if="name === 'star'">
      <path d="M12 3.6l2.6 5.2 5.8.85-4.2 4.1 1 5.75L12 16.8l-5.2 2.7 1-5.75-4.2-4.1 5.8-.85z" />
    </template>
    <template v-else-if="name === 'lock'">
      <rect x="5" y="10.5" width="14" height="9.5" rx="2.2" />
      <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" />
    </template>
    <template v-else-if="name === 'sunny'">
      <circle cx="12" cy="12" r="4" />
      <path
        d="M12 2.5v2.5M12 19v2.5M2.5 12h2.5M19 12h2.5M5.2 5.2l1.8 1.8M17 17l1.8 1.8M18.8 5.2L17 7M7 17l-1.8 1.8"
      />
    </template>
    <template v-else-if="name === 'cloudy'">
      <path d="M7.5 18h9a3.5 3.5 0 0 0 .3-7 5 5 0 0 0-9.6-1.2A3.4 3.4 0 0 0 7.5 18z" />
    </template>
    <template v-else-if="name === 'rain'">
      <path d="M7.5 15h9a3.5 3.5 0 0 0 .3-7 5 5 0 0 0-9.6-1.2A3.4 3.4 0 0 0 7.5 15z" />
      <path d="M9 18l-1 2.5M13 18l-1 2.5M17 18l-1 2.5" />
    </template>
    <template v-else-if="name === 'snow'">
      <path d="M7.5 15h9a3.5 3.5 0 0 0 .3-7 5 5 0 0 0-9.6-1.2A3.4 3.4 0 0 0 7.5 15z" />
      <path d="M9 18.5v.01M13 19.8v.01M17 18.5v.01" />
    </template>
    <template v-else-if="name === 'wind'">
      <path d="M3.5 9h10a2.5 2.5 0 1 0-2.5-2.5M3.5 13h14a2.5 2.5 0 1 1-2.5 2.5M3.5 17h7" />
    </template>
    <template v-else-if="name === 'fog'">
      <path d="M4 9h16M5.5 13h13M4 17h16" />
    </template>
    <template v-else-if="name === 'mood-great'">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M8.6 13.4c.9 2 2 3 3.4 3s2.5-1 3.4-3z" />
      <path d="M9.5 9.8v.01M14.5 9.8v.01" />
    </template>
    <template v-else-if="name === 'mood-good'">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M9 13.8c.7 1.3 1.7 1.9 3 1.9s2.3-.6 3-1.9" />
      <path d="M9.5 9.8v.01M14.5 9.8v.01" />
    </template>
    <template v-else-if="name === 'mood-ok'">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M9.5 14.4h5" />
      <path d="M9.5 9.8v.01M14.5 9.8v.01" />
    </template>
    <template v-else-if="name === 'mood-low'">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M9 15c.7-1.3 1.7-1.9 3-1.9s2.3.6 3 1.9" />
      <path d="M9.5 9.8v.01M14.5 9.8v.01" />
    </template>
    <template v-else-if="name === 'mood-bad'">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M8.6 15.4c.9-2 2-3 3.4-3s2.5 1 3.4 3z" />
      <path d="M9.5 9.8v.01M14.5 9.8v.01" />
    </template>
    <template v-else-if="name === 'sparkle'">
      <path d="M12 3.5l1.7 4.3 4.3 1.7-4.3 1.7L12 15.5l-1.7-4.3L6 9.5l4.3-1.7z" />
      <path d="M18.5 16l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z" />
    </template>
    <template v-else-if="name === 'map'">
      <path d="M3.5 6.5l6-2 5 2 6-2v13l-6 2-5-2-6 2z" />
      <path d="M9.5 4.5v13M14.5 6.5v13" />
    </template>
    <template v-else-if="name === 'image'">
      <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
      <path d="M3.5 15l4.5-4.5 4 4 3-2.5 5 4.5" />
      <circle cx="9" cy="9" r="1.4" />
    </template>
    <template v-else-if="name === 'camera'">
      <path d="M4 8.5h3l1.5-2h7L17 8.5h3v10H4z" />
      <circle cx="12" cy="13" r="3.2" />
    </template>
    <template v-else-if="name === 'attach'">
      <path d="M20.5 11.5l-7.8 7.8a5 5 0 0 1-7.1-7.1l8.5-8.5a3.2 3.2 0 0 1 4.5 4.5l-8.5 8.5a1.6 1.6 0 0 1-2.3-2.3l7.4-7.4" />
    </template>
    <template v-else-if="name === 'trash'">
      <path d="M4.5 7h15M9.5 7V4.5h5V7" />
      <path d="M6.5 7l1 12.5h9L17.5 7" />
      <path d="M10.5 10.5v6M13.5 10.5v6" />
    </template>
    <template v-else-if="name === 'refresh'">
      <path d="M20 12a8 8 0 1 1-2.6-5.9" />
      <path d="M20 4.5V11h-6.2" />
    </template>
    <template v-else-if="name === 'clock'">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.2V12l3.4 2" />
    </template>
  </svg>
</template>
