<script setup lang="ts">
const { site, t, locale } = useSite()
const stars = [
  [7, 29],
  [16, 65],
  [27, 16],
  [36, 8],
  [49, 70],
  [61, 13],
  [71, 64],
  [84, 22],
  [92, 52],
  [89, 83],
  [22, 86],
  [54, 42],
]
</script>
<template>
  <section class="home-intro" aria-labelledby="intro-heading">
    <div class="intro-atmosphere" aria-hidden="true">
      <span v-for="([x, y], index) in stars" :key="index" :style="{ left: `${x}%`, top: `${y}%` }">✦</span>
    </div>
    <div class="intro-center">
      <NuxtLink class="intro-avatar" :to="`/${locale}/about`" :aria-label="t('home.about')">
        <img
          v-if="site?.config.avatarId"
          :src="`/api/media/${site.config.avatarId}`"
          :alt="`${site.profile.displayName} · ${t('admin.avatar')}`"
          width="112"
          height="112"
          fetchpriority="high"
        />
        <OnionLogo v-else :size="76" />
      </NuxtLink>
      <p class="intro-greeting">
        {{ t('home.hello') }} <strong>{{ site?.profile.displayName }}</strong
        ><span class="intro-wave" aria-hidden="true">👋</span>
      </p>
      <h1 id="intro-heading">
        <span class="intro-role-mark" aria-hidden="true">✧</span>{{ site?.profile.headline }}
      </h1>
      <p class="intro-description">{{ site?.profile.description }}</p>
      <p v-if="site?.profile.quote" class="intro-quote">{{ site.profile.quote }}</p>
    </div>
    <a class="intro-scroll" href="#recent-writing"
      ><span>{{ t('home.scroll') }}</span
      ><AppIcon name="chevron" :size="15"
    /></a>
  </section>
</template>
