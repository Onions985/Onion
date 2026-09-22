<script setup lang="ts">
const { site } = useSite(),
  preferred = useCookie('onion_locale')
await navigateTo(
  `/${preferred.value === 'en' || preferred.value === 'zh' ? preferred.value : site.value?.config.defaultLocale || 'zh'}`,
  { redirectCode: 302 },
)
</script>
<template><div /></template>
