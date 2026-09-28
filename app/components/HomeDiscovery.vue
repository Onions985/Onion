<script setup lang="ts">
import type { ContentSummary } from '../../shared/types'
const { locale, t, contentUrl } = useSite()
const { data } = await useAsyncData(
  () => `selections:${locale.value}`,
  () => $fetch<{ items: ContentSummary[] }>('/api/selections', { query: { locale: locale.value } }),
)
</script>
<template>
  <section v-if="data?.items.length" class="home-section start-here" aria-labelledby="start-heading">
    <div class="section-heading">
      <div>
        <h2 id="start-heading">{{ t('start.title') }}</h2>
        <p class="discovery-hint">{{ t('start.subtitle') }}</p>
      </div>
      <AppIcon name="book" :size="24" />
    </div>
    <div class="selection-grid">
      <NuxtLink v-for="item in data.items" :key="item.id" :to="contentUrl(item)" class="selection-card">
        <span class="selection-kind"
          ><AppIcon :name="item.kind === 'project' ? 'code' : 'book'" :size="16" />{{
            t(`kind.${item.kind}`)
          }}</span
        >
        <h3>{{ item.title }}</h3>
        <p>{{ item.summary }}</p>
        <span class="selection-arrow"><AppIcon name="right" :size="18" /></span>
      </NuxtLink>
    </div>
  </section>
</template>
