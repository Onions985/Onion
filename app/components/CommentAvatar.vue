<script setup lang="ts">
const props = withDefaults(defineProps<{ isAuthor: boolean; name: string; compact?: boolean }>(), {
  compact: false,
})
const initial = computed(() => Array.from(props.name.trim())[0]?.toUpperCase() || '?')
</script>
<template>
  <div class="comment-avatar" :class="{ 'comment-avatar--compact': compact }" aria-hidden="true">
    <SiteAvatar v-if="isAuthor" :size="compact ? 28 : 34" />
    <span v-else>{{ initial }}</span>
  </div>
</template>
