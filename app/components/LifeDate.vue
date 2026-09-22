<script setup lang="ts">
const props = defineProps<{ value: string; fallback?: string }>()
const { locale } = useSite()
const iso = computed(() => {
  const candidate = props.value.slice(0, 10)
  const date = new Date(`${candidate}T00:00:00Z`)
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== candidate
    ? (props.fallback || '').slice(0, 10)
    : candidate
})
const month = computed(() => {
  const date = new Date(`${iso.value}T00:00:00Z`)
  return Number.isNaN(date.getTime())
    ? ''
    : new Intl.DateTimeFormat(locale.value === 'zh' ? 'zh-CN' : 'en', {
        month: 'short',
        timeZone: 'UTC',
      }).format(date)
})
</script>
<template>
  <time class="diary-date" :datetime="iso"
    ><span>{{ month }}</span
    ><strong>{{ iso.slice(8, 10) }}</strong
    ><small>{{ iso.slice(0, 4) }}</small></time
  >
</template>
