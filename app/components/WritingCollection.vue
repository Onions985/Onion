<script setup lang="ts">
import type { ContentSummary } from '../../shared/types'
const props = defineProps<{ items: ContentSummary[]; total: number; page: number }>()
const { site, locale, t, contentUrl, blogTag } = useSite()
const lead = computed(() => (props.page === 1 ? props.items[0] : undefined))
const archive = computed(() => (lead.value ? props.items.slice(1) : props.items))
const years = computed(() => [...new Set(archive.value.map((item) => item.publishedAt.slice(0, 4)))])
</script>
<template>
  <div class="writing-collection">
    <header class="writing-masthead">
      <div>
        <p class="eyebrow">
          <NuxtLink v-if="blogTag" :to="`/${locale}/writing`">{{ t('nav.writing') }} / </NuxtLink>BLOG
        </p>
        <h1>
          <template v-if="blogTag"><i># </i>{{ blogTag }}</template
          ><template v-else>{{ t('nav.writing') }}<i>.</i></template>
        </h1>
        <p>{{ t('writing.subtitle') }}</p>
      </div>
      <div class="writing-edition">
        <AppIcon name="book" :size="21" /><span>{{ t('kind.blog') }}</span
        ><strong>{{ String(total).padStart(2, '0') }}</strong>
      </div>
    </header>
    <BlogTagNav />
    <slot />
    <div v-if="items.length" class="writing-layout">
      <div class="writing-main">
        <article v-if="lead" class="writing-lead">
          <div class="meta">
            <ContentPin v-if="lead.pinned" /><span v-else class="writing-lead-label">{{
              t('home.latest')
            }}</span
            ><time>{{ lead.publishedAt.slice(0, 10) }}</time
            ><span>{{ lead.readingMinutes }} {{ t('minutes') }}</span>
          </div>
          <h2>
            <NuxtLink :to="contentUrl(lead)">{{ lead.title }}</NuxtLink>
          </h2>
          <p>{{ lead.summary }}</p>
          <BlogTagLinks :tags="lead.metadata.tags" />
          <NuxtLink v-if="lead.coverId" :to="contentUrl(lead)" :aria-label="lead.title"
            ><img :src="`/api/media/${lead.coverId}`" alt="" class="writing-lead-cover"
          /></NuxtLink>
          <div class="writing-lead-bottom">
            <span>{{ lead.metadata.category }}</span
            ><NuxtLink :to="contentUrl(lead)">{{ t('read') }}<AppIcon name="right" :size="16" /></NuxtLink>
          </div>
        </article>
        <section v-for="year in years" :key="year" class="writing-year">
          <h2>{{ year }}</h2>
          <div>
            <ContentCard
              v-for="item in archive.filter((item) => item.publishedAt.startsWith(year))"
              :key="item.id"
              :item="item"
            />
          </div>
        </section>
      </div>
      <aside class="writing-margin">
        <span class="margin-quote" aria-hidden="true">“</span>
        <p>{{ site?.profile.quote }}</p>
        <span>{{ site?.profile.displayName }}</span>
        <div class="margin-rule" aria-hidden="true" />
      </aside>
    </div>
  </div>
</template>
