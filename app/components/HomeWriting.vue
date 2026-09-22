<script setup lang="ts">
import type { ContentSummary } from '../../shared/types'

defineProps<{ items: ContentSummary[] }>()
const { locale, t, contentUrl } = useSite()
const date = (value: string) =>
  new Intl.DateTimeFormat(locale.value === 'zh' ? 'zh-CN' : 'en', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(value.replace(' ', 'T') + 'Z'))
</script>

<template>
  <section id="recent-writing" class="home-section home-writing">
    <header class="home-writing-heading" data-reveal>
      <div>
        <h2><span class="section-number" aria-hidden="true">01 /</span>{{ t('home.latest') }}</h2>
        <p>{{ t('writing.subtitle') }}</p>
      </div>
      <NuxtLink :to="`/${locale}/writing`" class="home-writing-all">
        {{ t('all') }}<AppIcon name="right" :size="16" />
      </NuxtLink>
    </header>
    <div v-if="items.length" class="home-writing-grid" :class="{ 'has-companions': items.length > 1 }">
      <article
        v-for="(item, index) in items"
        :key="item.id"
        class="home-story"
        :class="{ 'home-story-lead': index === 0 }"
        data-reveal
      >
        <div class="home-story-topline">
          <span class="home-story-category"
            ><AppIcon name="book" :size="15" />{{ item.metadata.category || t('kind.blog') }}</span
          >
          <ContentPin v-if="item.pinned" />
          <span v-else class="home-story-number" aria-hidden="true">{{
            String(index + 1).padStart(2, '0')
          }}</span>
        </div>
        <NuxtLink
          v-if="item.coverId && index === 0"
          :to="contentUrl(item)"
          class="home-story-cover"
          tabindex="-1"
          aria-hidden="true"
        >
          <img :src="`/api/media/${item.coverId}`" alt="" loading="lazy" decoding="async" />
        </NuxtLink>
        <h3>
          <NuxtLink :to="contentUrl(item)">{{ item.title }}</NuxtLink>
        </h3>
        <p class="home-story-summary">{{ item.summary }}</p>
        <BlogTagLinks :tags="item.metadata.tags.slice(0, index === 0 ? 4 : 3)" />
        <div class="home-story-bottom">
          <div class="home-story-meta">
            <time :datetime="item.publishedAt.slice(0, 10)">{{ date(item.publishedAt) }}</time>
            <span><AppIcon name="clock" :size="13" />{{ item.readingMinutes }} {{ t('minutes') }}</span>
          </div>
          <NuxtLink
            :to="contentUrl(item)"
            class="home-story-read"
            :aria-label="`${t('read')}：${item.title}`"
          >
            <span v-if="index === 0">{{ t('read') }}</span
            ><AppIcon name="right" :size="18" />
          </NuxtLink>
        </div>
      </article>
    </div>
    <p v-else class="empty-state" data-reveal>{{ t('empty') }}</p>
  </section>
</template>
