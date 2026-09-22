<script setup lang="ts">
withDefaults(defineProps<{ size?: number }>(), { size: 38 })
const { site } = useSite()
</script>
<template>
  <img
    v-if="site?.config.avatarId"
    class="site-avatar"
    :src="`/api/media/${site.config.avatarId}`"
    :width="size"
    :height="size"
    alt=""
    aria-hidden="true"
  />
  <OnionLogo v-else :size="size" />
</template>
