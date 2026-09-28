<script setup lang="ts">
import { hasContact } from '#shared/contact'
defineProps<{ description?: boolean }>()
const { site, locale, t } = useSite()
</script>
<template>
  <div class="follow-links">
    <p v-if="description">{{ t('follow.hint') }}</p>
    <nav :aria-label="t('follow.title')">
      <a :href="`/feed.xml?locale=${locale}`"><AppIcon name="rss" :size="16" />{{ t('follow.rss') }}</a>
      <a
        v-for="link in site?.config.socialLinks"
        :key="link.url"
        :href="link.url"
        target="_blank"
        rel="noopener noreferrer"
        >{{ link.label }}<AppIcon name="arrow" :size="13"
      /></a>
      <NuxtLink v-if="hasContact(site?.config.contact)" :to="`/${locale}/about#contact`">{{
        t('about.contact')
      }}</NuxtLink>
    </nav>
  </div>
</template>
