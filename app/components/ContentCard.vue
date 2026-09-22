<script setup lang="ts">
import type { ContentSummary } from '../../shared/types'
defineProps<{ item: ContentSummary }>()
const { locale, t, contentUrl } = useSite()
const date = (value: string) =>
  new Intl.DateTimeFormat(locale.value === 'zh' ? 'zh-CN' : 'en', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(value.replace(' ', 'T') + 'Z'))
</script>
<template>
  <article v-if="item.kind === 'blog'" class="article-row">
    <div class="article-date"><ContentPin v-if="item.pinned" />{{ date(item.publishedAt) }}</div>
    <div class="article-copy">
      <NuxtLink :to="contentUrl(item)" class="article-title">
        <h3>{{ item.title }}</h3>
        <AppIcon name="arrow" :size="17" />
      </NuxtLink>
      <p>{{ item.summary }}</p>
      <BlogTagLinks :tags="item.metadata.tags" />
      <div class="meta">
        <span>{{ item.metadata.category }}</span
        ><span>{{ item.readingMinutes }} {{ t('minutes') }}</span>
      </div>
    </div>
  </article>
  <ProjectCard v-else-if="item.kind === 'project'" :item="item" />
  <LifeMoment v-else :item="item" />
</template>
