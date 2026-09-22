<script setup lang="ts">
import type { ContentSummary } from '../../shared/types'
defineProps<{ items: ContentSummary[]; total: number; page: number }>()
const { site, t } = useSite()
</script>
<template>
  <div class="life-collection">
    <header class="life-masthead">
      <div>
        <p class="eyebrow"><AppIcon name="leaf" :size="16" />JOURNAL</p>
        <h1>{{ t('nav.life') }}<i>.</i></h1>
        <p>{{ t('life.subtitle') }}</p>
      </div>
      <div class="life-owner">
        <SiteAvatar :size="40" />
        <div>
          <strong>{{ site?.profile.displayName }}</strong
          ><span>{{ site?.profile.motto }}</span>
        </div>
      </div>
    </header>
    <slot />
    <div v-if="items.length" class="life-timeline">
      <LifeMoment v-for="item in items" :key="item.id" :item="item" />
    </div>
  </div>
</template>
