<script setup lang="ts">
import type { ContentSummary } from '../../shared/types'
const props = defineProps<{ item: ContentSummary }>()
const { contentUrl, t } = useSite()
const images = computed(
  () => props.item.metadata.moment?.imageIds || (props.item.coverId ? [props.item.coverId] : []),
)
</script>
<template>
  <article class="life-moment" :class="{ 'moment-with-photo': images.length }">
    <LifeDate :value="item.metadata.occurredOn || item.publishedAt" :fallback="item.publishedAt" />
    <div class="moment-entry">
      <ContentPin v-if="item.pinned" />
      <MomentByline :date="item.metadata.occurredOn || item.publishedAt" :location="item.metadata.location" />
      <NuxtLink
        v-if="item.metadata.moment?.text || !item.metadata.moment"
        :to="contentUrl(item)"
        class="moment-status-text moment-status-preview"
      >
        <template v-if="item.metadata.moment">{{ item.metadata.moment.text }}</template>
        <template v-else
          >{{ item.title
          }}<template v-if="item.summary && item.summary !== item.title">{{
            '\n' + item.summary
          }}</template></template
        >
      </NuxtLink>
      <MomentGallery :images="images" />
      <footer class="moment-card-footer">
        <span class="moment-category"><AppIcon name="leaf" :size="15" />{{ t('nav.life') }}</span>
        <NuxtLink :to="contentUrl(item)" class="moment-discussion"
          ><AppIcon name="chat" :size="16" />{{ t('moment.view') }}<AppIcon name="right" :size="14"
        /></NuxtLink>
      </footer>
    </div>
  </article>
</template>
