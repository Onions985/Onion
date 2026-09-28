<script setup lang="ts">
withDefaults(defineProps<{ name: string; size?: number }>(), { size: 18 })
const paths: Record<string, string> = {
  rss: 'M4 11a9 9 0 0 1 9 9M4 4a16 16 0 0 1 16 16M5 19h.01',
  home: 'm3 10 9-7 9 7v10H3ZM9 20v-7h6v7',
  thumbtack: 'm16 3 5 5-4 1-4 4v4l-2 2-6-6 2-2h4l4-4ZM2 22l5-5',
  mail: 'M3 5h18v14H3Zm0 1 9 7 9-7',
  chat: 'M21 11a8 8 0 0 1-8 8H7l-4 3v-7a8 8 0 1 1 18-4ZM8 10h.01M12 10h.01M16 10h.01',
  chevron: 'm6 9 6 6 6-6',
  close: 'm6 6 12 12M18 6 6 18',
  user: 'M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM4 21v-2a8 8 0 0 1 16 0v2',
  arrow: 'M7 17 17 7M7 7h10v10',
  right: 'M5 12h14m-6-6 6 6-6 6',
  left: 'M19 12H5m6-6-6 6 6 6',
  search: 'm21 21-4.5-4.5M19 10.5a8.5 8.5 0 1 1-17 0 8.5 8.5 0 0 1 17 0',
  sun: 'M12 3V1m0 22v-2M3 12H1m22 0h-2M4.2 4.2 2.8 2.8m18.4 18.4-1.4-1.4M4.2 19.8l-1.4 1.4M21.2 2.8l-1.4 1.4M17 12a5 5 0 1 1-10 0 5 5 0 0 1 10 0',
  moon: 'M21 12.8A9 9 0 0 1 11.2 3 9 9 0 1 0 21 12.8',
  code: 'm8 7-5 5 5 5m8-10 5 5-5 5m-3-14-2 18',
  leaf: 'M20 4C8 2 2 8 5 15s15 5 15-11ZM4 21 15 10',
  book: 'M4 3h13a3 3 0 0 1 3 3v15H6a3 3 0 0 1-3-3V6a3 3 0 0 1 1-3Zm-1 15a3 3 0 0 1 3-3h14M7 6h8',
  plus: 'M12 5v14M5 12h14',
  expand: 'M8 3H3v5m13-5h5v5M3 16v5h5m8 0h5v-5',
  smile: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM8 9h.01M16 9h.01M8 14a4 4 0 0 0 8 0',
  image: 'M3 3h18v18H3Zm0 14 6-6 4 4 3-3 5 5M8 7h.01',
  check: 'm5 12 4 4L19 6',
  settings:
    'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8M12 2v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2',
  logout: 'M9 3H4v18h5m5-14 5 5-5 5M8 12h12',
  clock: 'M12 8v5l3 2M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
  globe: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM3 12h18M12 3c5 5 5 13 0 18-5-5-5-13 0-18',
  pin: 'M19 10c0 6-7 11-7 11S5 16 5 10a7 7 0 1 1 14 0ZM14 10a2 2 0 1 1-4 0 2 2 0 0 1 4 0',
}
</script>
<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.5"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path :d="paths[name] || paths.arrow" />
  </svg>
</template>
