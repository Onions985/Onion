<script setup lang="ts">
defineProps<{ tags: string[] }>()
const { tagUrl } = useSite()
</script>
<template>
  <div v-if="tags.length" class="article-tags">
    <NuxtLink v-for="tag in tags" :key="tag" :to="tagUrl(tag)"># {{ tag }}</NuxtLink>
  </div>
</template>
