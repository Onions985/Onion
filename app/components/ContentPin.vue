<script setup lang="ts">
const { t } = useSite()
</script>
<template>
  <span class="content-pin"><AppIcon name="thumbtack" :size="13" />{{ t('content.pinned') }}</span>
</template>
