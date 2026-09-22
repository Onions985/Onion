<script setup lang="ts">
import type { ContentSummary } from '../../shared/types'
const props = defineProps<{ item: ContentSummary }>()
const initials = computed(() => {
  const words = props.item.title.trim().split(/\s+/u)
  return (
    words.length > 1
      ? words
          .slice(0, 2)
          .map((word) => Array.from(word)[0])
          .join('')
      : Array.from(words[0] || '')
          .slice(0, 2)
          .join('')
  ).toUpperCase()
})
const tone = computed(() => {
  const hash = Array.from(props.item.slug).reduce((sum, char) => (sum * 31 + char.codePointAt(0)!) >>> 0, 0)
  return ['violet', 'blue', 'sage'][hash % 3]
})
</script>
<template>
  <div class="project-artwork" :data-tone="tone" :class="{ 'has-cover': item.coverId }" aria-hidden="true">
    <img v-if="item.coverId" :src="`/api/media/${item.coverId}`" alt="" loading="lazy" />
    <template v-else>
      <div class="project-art-grid" />
      <div class="project-art-sheet sheet-back" />
      <div class="project-art-sheet sheet-front">
        <div class="art-sheet-top"><AppIcon name="code" :size="18" /><span /><span /><span /></div>
        <strong>{{ initials }}</strong>
        <span class="art-sheet-name">{{ item.title }}</span>
        <div class="art-sheet-lines"><i /><i /><i /></div>
      </div>
      <span class="project-art-cross art-cross-one">+</span
      ><span class="project-art-cross art-cross-two">+</span>
    </template>
  </div>
</template>
