<script setup lang="ts">
withDefaults(defineProps<{ full?: boolean }>(), { full: false })
const { site, t } = useSite()
</script>
<template>
  <div class="character-portrait" :class="{ 'portrait-full': full }">
    <div class="portrait-panel" aria-hidden="true">
      <div class="portrait-grid" />
      <span class="portrait-word">{{ site?.profile.siteName }}</span>
      <span class="portrait-cross cross-top">+</span>
      <span class="portrait-cross cross-bottom">+</span>
    </div>
    <img
      class="character-image"
      src="/images/onion-character.png"
      :alt="`${site?.profile.displayName || 'Onion'} · ${t('nav.about')}`"
      width="1024"
      height="1536"
      :loading="full ? 'lazy' : 'eager'"
      :fetchpriority="full ? 'auto' : 'high'"
    />
    <div class="portrait-caption">
      <span>{{ site?.profile.displayName }}<i>.</i></span>
      <span>{{ site?.profile.motto }}</span>
    </div>
  </div>
</template>
