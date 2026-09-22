<script setup lang="ts">
const { site, t, locale, theme, preference, translations } = useSite(),
  route = useRoute(),
  { fail } = useFeedback()
async function switchLanguage() {
  const next = locale.value === 'zh' ? 'en' : 'zh'
  try {
    let destination = route.path.startsWith('/admin')
      ? route.fullPath
      : route.fullPath.replace(/^\/(zh|en)/, `/${next}`)
    if (route.params.slug) {
      const section = route.path.split('/')[2]
      const translated =
        section === 'posts'
          ? translations.value.find((v) => v.locale === next) ||
            translations.value.find((v) => v.locale === 'zh')
          : undefined
      destination = `/${next}/${section}/${translated?.slug || route.params.slug}`
    }
    await preference(next, theme.value)
    await navigateTo(destination)
  } catch (e) {
    fail(e)
  }
}
async function toggleTheme() {
  try {
    const dark =
      theme.value === 'dark' ||
      (theme.value === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
    await preference(locale.value, dark ? 'light' : 'dark')
  } catch (e) {
    fail(e)
  }
}
</script>
<template>
  <header class="site-header">
    <NuxtLink :to="`/${locale}`" class="wordmark" :aria-label="site?.profile.siteName"
      ><SiteAvatar :size="38" /><span>{{ site?.profile.siteName }}<i>.</i></span></NuxtLink
    >
    <SiteNavigation />
    <div class="header-tools">
      <NuxtLink class="icon-button" :to="`/${locale}/search`" :aria-label="t('search')"
        ><AppIcon name="search" /></NuxtLink
      ><button class="icon-button language-button" :aria-label="t('language')" @click="switchLanguage">
        {{ locale === 'zh' ? 'EN' : '中' }}</button
      ><button class="icon-button theme-button" :aria-label="t('theme')" @click="toggleTheme">
        <AppIcon name="sun" class="light-icon" /><AppIcon name="moon" class="dark-icon" />
      </button>
    </div>
  </header>
</template>
