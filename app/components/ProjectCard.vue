<script setup lang="ts">
import type { ContentSummary } from '../../shared/types'
withDefaults(defineProps<{ item: ContentSummary; showcase?: boolean; index?: number }>(), {
  showcase: false,
  index: 0,
})
const { t, contentUrl } = useSite()
</script>
<template>
  <article class="work-card" :class="{ 'work-showcase': showcase, 'is-flagship': item.metadata.flagship }">
    <NuxtLink :to="contentUrl(item)" class="work-cover-link" :aria-label="item.title"
      ><ProjectArtwork :item="item"
    /></NuxtLink>
    <div class="work-copy">
      <div v-if="item.pinned || item.metadata.flagship" class="work-markers">
        <ContentPin v-if="item.pinned" /><span v-if="item.metadata.flagship" class="work-flagship">{{
          t('project.flagship')
        }}</span>
      </div>
      <div class="work-kicker">
        <span
          ><template v-if="showcase">{{ String(index + 1).padStart(2, '0') }} / </template
          >{{ item.metadata.category || t('kind.project') }}</span
        ><span v-if="item.metadata.projectStatus" class="work-status"
          ><i />{{ item.metadata.projectStatus }}</span
        >
      </div>
      <h2>
        <NuxtLink :to="contentUrl(item)">{{ item.title }}<AppIcon name="arrow" :size="22" /></NuxtLink>
      </h2>
      <p>{{ item.summary }}</p>
      <div v-if="item.metadata.technologies.length" class="work-stack">
        <span v-for="tech in item.metadata.technologies" :key="tech">{{ tech }}</span>
      </div>
      <div v-if="item.metadata.projectUrl || item.metadata.repositoryUrl" class="work-links">
        <a
          v-if="item.metadata.projectUrl"
          :href="item.metadata.projectUrl"
          target="_blank"
          rel="noopener noreferrer"
          >{{ t('project.visit') }}<AppIcon name="arrow" :size="15"
        /></a>
        <a
          v-if="item.metadata.repositoryUrl"
          :href="item.metadata.repositoryUrl"
          target="_blank"
          rel="noopener noreferrer"
          ><AppIcon name="code" :size="16" />{{ t('project.source') }}</a
        >
      </div>
    </div>
  </article>
</template>
