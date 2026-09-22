<script setup lang="ts">
import type { ContentSummary } from '../../../shared/types'
definePageMeta({ validate: (route) => ['zh', 'en'].includes(String(route.params.locale)) })
const { site, locale, t } = useSite()
const revealRoot = ref<HTMLElement>()
useScrollReveal(revealRoot)
const { data } = await useAsyncData(
  () => `home:${locale.value}`,
  async () => {
    const results = await Promise.all(
      ['blog', 'project', 'life'].map((kind) =>
        $fetch<{ items: ContentSummary[] }>('/api/content', {
          query: { locale: locale.value, kind, featured: kind === 'project' ? 'true' : undefined },
        }),
      ),
    )
    return {
      blog: results[0]!.items.slice(0, 3),
      project: results[1]!.items.slice(0, 2),
      life: results[2]!.items.slice(0, 3),
    }
  },
)
useSeoMeta({ title: () => t('nav.home'), description: () => site.value?.profile.description })
</script>
<template>
  <HomeIntroduction />
  <div ref="revealRoot" class="home-content">
    <HomeWriting :items="data?.blog || []" />
    <section class="home-section">
      <div class="section-heading" data-reveal>
        <h2><span class="section-number" aria-hidden="true">02 /</span>{{ t('home.projects') }}</h2>
        <NuxtLink :to="`/${locale}/projects`">{{ t('all') }}<AppIcon name="right" :size="14" /></NuxtLink>
      </div>
      <div class="project-grid">
        <ProjectCard
          data-reveal
          v-for="(item, index) in data?.project"
          :key="item.id"
          :item="item"
          :index="index"
        />
      </div>
      <p v-if="!data?.project.length" class="empty-state" data-reveal>{{ t('empty') }}</p>
    </section>
    <section class="home-section">
      <div class="section-heading" data-reveal>
        <h2><span class="section-number" aria-hidden="true">03 /</span>{{ t('home.life') }}</h2>
        <NuxtLink :to="`/${locale}/life`">{{ t('all') }}<AppIcon name="right" :size="14" /></NuxtLink>
      </div>
      <div class="life-timeline home-life-timeline">
        <LifeMoment data-reveal v-for="item in data?.life" :key="item.id" :item="item" />
      </div>
      <p v-if="!data?.life.length" class="empty-state" data-reveal>{{ t('empty') }}</p>
    </section>
  </div>
</template>
