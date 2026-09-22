<script setup lang="ts">
const { t } = useSite(),
  { fail } = useFeedback(),
  email = ref(''),
  password = ref(''),
  busy = ref(false)
useSeoMeta({ title: () => t('admin.login'), robots: 'noindex,nofollow' })
async function login() {
  busy.value = true
  try {
    await apiWrite('/api/auth/login', 'POST', { email: email.value, password: password.value })
    await navigateTo('/admin')
  } catch (e) {
    fail(e)
  } finally {
    busy.value = false
  }
}
</script>
<template>
  <form class="login-box" @submit.prevent="login">
    <OnionLogo :size="54" />
    <h1 style="margin-top: 24px">{{ t('admin.login') }}</h1>
    <p>{{ t('admin.loginHelp') }}</p>
    <label class="field"
      ><span>{{ t('admin.email') }}</span
      ><input v-model="email" type="email" autocomplete="username" required maxlength="254" /></label
    ><label class="field"
      ><span>{{ t('admin.password') }}</span
      ><input
        v-model="password"
        type="password"
        autocomplete="current-password"
        required
        maxlength="512" /></label
    ><button class="button primary" :disabled="busy">
      {{ t(busy ? 'loading' : 'admin.loginButton') }}<AppIcon name="right" :size="15" />
    </button>
  </form>
</template>
