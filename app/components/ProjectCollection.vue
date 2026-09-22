<script setup lang="ts">
import type { ContentSummary } from '../../shared/types'
defineProps<{ items: ContentSummary[]; total: number; page: number }>()
const { t } = useSite()
</script>
<template>
  <div class="project-collection">
    <header class="works-masthead">
      <div>
        <p class="eyebrow">
          <AppIcon name="code" :size="16" />PROJECTS <span>/ {{ String(total).padStart(2, '0') }}</span>
        </p>
        <h1>{{ t('home.projects') }}<i>_</i></h1>
        <p>{{ t('projects.subtitle') }}</p>
      </div>
      <div class="works-symbol" aria-hidden="true"><span>&lt;</span><i>/</i><span>&gt;</span></div>
    </header>
    <slot />
    <div v-if="items.length" class="works-showroom">
      <ProjectCard
        v-for="(item, index) in items"
        :key="item.id"
        :item="item"
        :index="(page - 1) * 12 + index"
        showcase
      />
    </div>
  </div>
</template>
