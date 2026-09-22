<script setup lang="ts">
const { t, locale } = useSite(),
  { fail } = useFeedback()
async function logout() {
  try {
    await apiWrite('/api/auth/logout', 'POST')
    await navigateTo('/admin/login')
  } catch (e) {
    fail(e)
  }
}
</script>
<template>
  <div class="admin-shell">
    <SiteHeader />
    <div class="admin-navigation">
      <NuxtLink to="/admin" class="admin-brand">{{ t('admin.title') }}<span class="status-dot" /></NuxtLink>
      <nav>
        <NuxtLink to="/admin" :exact="true">{{ t('admin.content') }}</NuxtLink
        ><NuxtLink to="/admin/comments">{{ t('admin.comments') }}</NuxtLink
        ><NuxtLink to="/admin/media">{{ t('admin.media') }}</NuxtLink
        ><NuxtLink to="/admin/settings">{{ t('admin.settings') }}</NuxtLink
        ><button class="icon-button" :aria-label="t('admin.logout')" @click="logout">
          <AppIcon name="logout" />
        </button>
      </nav>
    </div>
    <main class="admin-main"><slot /></main>
    <SiteFooter />
  </div>
</template>
