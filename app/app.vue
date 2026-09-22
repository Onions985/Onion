<script setup lang="ts">
import type { SiteResponse } from '../shared/types'
const { locale, site, theme } = useSite()
const request = useRequestFetch()
const { data, error } = await useAsyncData(
  () => `site:${locale.value}`,
  () => request<SiteResponse>('/api/site', { query: { locale: locale.value } }),
)
watch(
  data,
  (value) => {
    if (value) {
      site.value = value
      theme.value = value.preference.theme
    }
  },
  { immediate: true },
)
useHead(() => ({
  htmlAttrs: {
    lang: locale.value === 'zh' ? 'zh-CN' : 'en',
    'data-theme': theme.value,
    'data-accent': site.value?.config.accent || 'lilac',
  },
  link: [
    {
      key: 'site-icon',
      rel: 'icon',
      href: site.value?.config.avatarId
        ? `/api/media/${site.value.config.avatarId}`
        : '/brand/onion-mark.svg',
    },
  ],
  titleTemplate: site.value ? `%s · ${site.value.profile.siteName}` : 'onion',
}))
const { message } = useFeedback()
let timeout: ReturnType<typeof setTimeout>
watch(message, () => {
  clearTimeout(timeout)
  timeout = setTimeout(() => (message.value = { text: '', error: false }), 5000)
})
onUnmounted(() => clearTimeout(timeout))
</script>
<template>
  <NuxtLoadingIndicator color="#a895cb" />
  <div v-if="error && !site" class="setup-error">
    <OnionLogo :size="54" />
    <h1>{{ locale === 'zh' ? '洋葱小站' : 'onion' }}</h1>
    <p>暂时无法读取网站数据 / Unable to load the site.</p>
    <p>请确认 MySQL 已启动并执行 <code>npm run db:init</code>。</p>
    <button class="button" @click="reloadNuxtApp()">重新加载 / Reload</button>
  </div>
  <NuxtLayout v-else><NuxtPage /></NuxtLayout>
  <div
    v-if="message.text"
    class="toast"
    :class="{ danger: message.error }"
    :role="message.error ? 'alert' : 'status'"
  >
    {{ message.text }}<button aria-label="关闭 / Close" @click="message.text = ''">×</button>
  </div>
</template>
