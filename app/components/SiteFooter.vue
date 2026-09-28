<script setup lang="ts">
const { site, locale, t } = useSite()
</script>
<template>
  <footer class="site-footer">
    <div>
      <NuxtLink :to="`/${locale}`" class="footer-name"
        ><SiteAvatar :size="32" />{{ site?.profile.siteName }}<i>.</i></NuxtLink
      >
      <p>{{ site?.profile.footer }}</p>
      <FollowLinks />
    </div>
    <div class="footer-right">
      <span>© {{ new Date().getFullYear() }} {{ site?.profile.displayName }}</span
      ><NuxtLink to="/admin">{{ t('footer.admin') }} <AppIcon name="arrow" :size="13" /></NuxtLink>
    </div>
  </footer>
</template>
