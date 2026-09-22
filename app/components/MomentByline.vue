<script setup lang="ts">
const props = defineProps<{ date: string; location?: string }>()
const { site, locale } = useSite()
const iso = computed(() => props.date.slice(0, 10))
const dateLabel = computed(() => {
  const date = new Date(`${iso.value}T00:00:00Z`)
  if (Number.isNaN(date.getTime())) return iso.value
  return new Intl.DateTimeFormat(locale.value === 'zh' ? 'zh-CN' : 'en', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    weekday: 'short',
    timeZone: 'UTC',
  }).format(date)
})
</script>
<template>
  <div class="moment-identity">
    <SiteAvatar :size="38" />
    <div class="moment-identity-copy">
      <strong>{{ site?.profile.displayName }}</strong>
      <time :datetime="iso">{{ dateLabel }}</time>
    </div>
    <span v-if="location" class="moment-place"><AppIcon name="pin" :size="14" />{{ location }}</span>
  </div>
</template>
