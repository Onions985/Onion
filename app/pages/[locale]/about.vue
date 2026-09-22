<script setup lang="ts">
import type { ContentSummary } from '../../../shared/types'
definePageMeta({ validate: (route) => ['zh', 'en'].includes(String(route.params.locale)) })
const { site, t, locale, contentUrl } = useSite()
const contact = computed(() => site.value?.config.contact)
const facts = [
  { icon: 'pin', label: 'about.locationLabel', value: 'about.locationValue' },
  { icon: 'code', label: 'about.sinceLabel', value: 'about.sinceValue' },
  { icon: 'leaf', label: 'about.workLabel', value: 'about.workValue' },
]
const { data: projects } = await useAsyncData(
  () => `about-projects:${locale.value}`,
  () =>
    $fetch<{ items: ContentSummary[] }>('/api/content', { query: { kind: 'project', locale: locale.value } }),
)
useSeoMeta({ title: () => t('nav.about'), description: () => site.value?.profile.description })
</script>
<template>
  <div class="about-page">
    <header class="page-heading">
      <p class="eyebrow">ABOUT ME</p>
      <h1>{{ t('nav.about') }}<i>.</i></h1>
      <p>{{ t('about.subtitle') }}</p>
    </header>
    <dl class="about-facts">
      <div v-for="fact in facts" :key="fact.label">
        <AppIcon :name="fact.icon" :size="20" />
        <dt>{{ t(fact.label) }}</dt>
        <dd>{{ t(fact.value) }}</dd>
      </div>
    </dl>
    <div class="about-layout">
      <div class="prose about-prose" v-html="site?.aboutHtml" />
      <aside class="about-persona">
        <CharacterPortrait full />
        <blockquote class="about-personal-quote">{{ site?.profile.quote }}</blockquote>
        <div class="hero-signature"><span class="status-dot" />{{ site?.profile.motto }}</div>
      </aside>
    </div>
    <section v-if="projects?.items.length" class="about-projects" aria-labelledby="about-projects-heading">
      <div class="about-section-heading">
        <div>
          <h2 id="about-projects-heading">{{ t('about.projectsTitle') }}</h2>
          <p>{{ t('about.projectsIntro') }}</p>
        </div>
        <NuxtLink :to="`/${locale}/projects`">{{ t('all') }}<AppIcon name="right" :size="16" /></NuxtLink>
      </div>
      <div class="about-project-grid">
        <NuxtLink
          v-for="project in projects.items.slice(0, 4)"
          :key="project.id"
          :to="contentUrl(project)"
          class="about-project-card"
        >
          <span v-if="project.metadata.flagship" class="about-project-flagship"
            ><AppIcon name="pin" :size="12" />{{ t('project.flagship') }}</span
          >
          <img
            v-if="project.coverId"
            :src="`/api/media/${project.coverId}`"
            :alt="project.title"
            loading="lazy"
          />
          <div class="about-project-copy">
            <h3>{{ project.title }}</h3>
            <p>{{ project.summary }}</p>
            <span>{{ t('about.projectDetails') }}<AppIcon name="arrow" :size="16" /></span>
          </div>
        </NuxtLink>
      </div>
    </section>
    <section
      v-if="contact?.wechat || contact?.email"
      id="contact"
      class="about-contact"
      aria-labelledby="contact-heading"
    >
      <h2 id="contact-heading">{{ t('about.contact') }}</h2>
      <p>{{ t('about.contactHint') }}</p>
      <ul class="about-contact-topics">
        <li
          v-for="key in ['about.talkTech', 'about.collaborate', 'about.development', 'about.makeFriends']"
          :key="key"
        >
          <AppIcon name="check" :size="14" />{{ t(key) }}
        </li>
      </ul>
      <dl class="contact-list">
        <div v-if="contact.wechat" class="contact-card">
          <AppIcon name="chat" :size="23" />
          <dt>{{ t('about.wechat') }}</dt>
          <dd>{{ contact.wechat }}</dd>
        </div>
        <div v-if="contact.email" class="contact-card">
          <AppIcon name="mail" :size="23" />
          <dt>{{ t('about.email') }}</dt>
          <dd>
            <a :href="`mailto:${contact.email}`">{{ contact.email }}<AppIcon name="arrow" :size="16" /></a>
          </dd>
        </div>
      </dl>
    </section>
  </div>
</template>
