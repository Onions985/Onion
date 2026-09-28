<script setup lang="ts">
import type { SiteConfig, SiteProfile, Locale, SiteResponse } from '../../../shared/types'
definePageMeta({ layout: 'admin', middleware: 'admin' })
const { t, locale, site } = useSite(),
  { notify, fail } = useFeedback(),
  request = useRequestFetch(),
  busy = ref(false),
  contentLocale = ref<Locale>(locale.value)
const { data } = await useAsyncData('admin-settings', () =>
  request<{ config: SiteConfig; profiles: SiteProfile[] }>('/api/admin/site'),
)
const form = reactive(structuredClone(toRaw(data.value)!)),
  profile = computed(() => form.profiles.find((p) => p.locale === contentLocale.value)!)
form.config.contact ??= { wechat: '', email: '' }
form.config.contact.qq ??= ''
form.config.contact.wechatQrId ??= null
const contact = computed(() => form.config.contact!)
const uploadingAvatar = ref(false)
const uploadingWechatQr = ref(false)
const fields = ['siteName', 'displayName', 'headline', 'description', 'motto', 'footer', 'quote'] as const
const writingTags = computed({
  get: () => (form.config.writingTags || []).join(', '),
  set: (value: string) => {
    form.config.writingTags = [
      ...new Set(
        value
          .split(/[,，]/)
          .map((tag) => tag.trim())
          .filter(Boolean),
      ),
    ]
  },
})
const navigation = [
  { path: '', label: 'nav.home' },
  { path: 'writing', label: 'nav.writing' },
  { path: 'projects', label: 'nav.projects' },
  { path: 'life', label: 'nav.life' },
  { path: 'about', label: 'nav.about' },
]
function toggleNav(item: { path: string; label: string }, checked: boolean) {
  form.config.navigation = checked
    ? navigation.filter((n) => n.path === item.path || form.config.navigation.some((v) => v.path === n.path))
    : form.config.navigation.filter((n) => n.path !== item.path)
}
async function save() {
  if (busy.value || uploadingAvatar.value || uploadingWechatQr.value) return
  busy.value = true
  try {
    await apiWrite('/api/admin/site', 'PUT', form)
    site.value = await $fetch<SiteResponse>('/api/site', { query: { locale: locale.value } })
    await refreshNuxtData()
    notify(t('admin.saved'))
  } catch (e) {
    fail(e)
  } finally {
    busy.value = false
  }
}
async function avatar(event: Event) {
  const input = event.target as HTMLInputElement,
    file = input.files?.[0]
  if (!file) return
  uploadingAvatar.value = true
  try {
    const body = new FormData()
    body.append('file', file)
    const asset = await apiWrite<{ id: string }>('/api/admin/media', 'POST', body)
    form.config.avatarId = asset.id
  } catch (e) {
    fail(e)
  } finally {
    input.value = ''
    uploadingAvatar.value = false
  }
}
useSeoMeta({ title: () => t('admin.settings'), robots: 'noindex,nofollow' })
async function uploadWechatQr(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  uploadingWechatQr.value = true
  try {
    const body = new FormData()
    body.append('file', file)
    const asset = await apiWrite<{ id: string }>('/api/admin/media', 'POST', body)
    contact.value.wechatQrId = asset.id
  } catch (error) {
    fail(error)
  } finally {
    input.value = ''
    uploadingWechatQr.value = false
  }
}
</script>
<template>
  <form @submit.prevent="save">
    <div class="admin-heading">
      <h1>{{ t('admin.settings') }}</h1>
      <button class="button primary" :disabled="busy || uploadingAvatar || uploadingWechatQr">
        {{ t(busy ? 'loading' : 'admin.settingsSave') }}
      </button>
    </div>
    <div class="settings-grid">
      <div>
        <div class="segmented" style="margin-bottom: 24px">
          <button
            v-for="lang in ['zh', 'en'] as const"
            :key="lang"
            type="button"
            :class="{ selected: contentLocale === lang }"
            @click="contentLocale = lang"
          >
            {{ lang === 'zh' ? '中文' : 'English' }}
          </button>
        </div>
        <div class="form-grid">
          <label
            v-for="key in fields"
            :key="key"
            class="field"
            :class="{ wide: ['headline', 'description', 'quote'].includes(key) }"
            ><span>{{ t(`admin.${key}`) }}</span
            ><textarea v-if="['description', 'quote'].includes(key)" v-model="profile[key]" rows="3" /><input
              v-else
              v-model="profile[key]"
              :required="['siteName', 'displayName', 'headline'].includes(key)" /></label
          ><label class="field wide"
            ><span>{{ t('admin.about') }}</span
            ><textarea v-model="profile.aboutMarkdown" rows="12" />
          </label>
        </div>
      </div>
      <aside class="settings-panel">
        <label class="field"
          ><span>{{ t('admin.defaultLocale') }}</span
          ><select v-model="form.config.defaultLocale">
            <option value="zh">中文</option>
            <option value="en">English</option>
          </select></label
        ><label class="field"
          ><span>{{ t('admin.defaultTheme') }}</span
          ><select v-model="form.config.defaultTheme">
            <option v-for="value in ['system', 'light', 'dark']" :key="value" :value="value">
              {{ t(`theme.${value}`) }}
            </option>
          </select></label
        ><label class="field"
          ><span>{{ t('admin.accent') }}</span
          ><select v-model="form.config.accent">
            <option value="lilac">{{ locale === 'zh' ? '丁香紫' : 'Lilac' }}</option>
            <option value="rose">{{ locale === 'zh' ? '玫瑰' : 'Rose' }}</option>
            <option value="sage">{{ locale === 'zh' ? '鼠尾草' : 'Sage' }}</option>
          </select></label
        >
        <div class="field">
          <span>{{ t('admin.avatar') }}</span
          ><label class="upload-box"
            ><img
              v-if="form.config.avatarId"
              :src="`/api/media/${form.config.avatarId}`"
              :alt="t('admin.avatar')" /><span v-else><AppIcon name="image" />{{ t('admin.upload') }}</span
            ><input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              :aria-label="t('admin.avatar')"
              :disabled="uploadingAvatar"
              @change="avatar" /></label
          ><button
            v-if="form.config.avatarId"
            type="button"
            class="small-button"
            @click="form.config.avatarId = null"
          >
            {{ t('admin.removeCover') }}
          </button>
        </div>
        <p class="avatar-setting-hint">{{ t(uploadingAvatar ? 'loading' : 'admin.avatarHint') }}</p>
        <h2>{{ t('about.contact') }}</h2>
        <label class="field"
          ><span>{{ t('about.qq') }}</span
          ><input
            v-model="contact.qq"
            inputmode="numeric"
            pattern="[1-9][0-9]{4,11}"
            maxlength="12"
            autocomplete="off"
        /></label>
        <label class="field"
          ><span>{{ t('about.wechat') }}</span
          ><input v-model="contact.wechat" maxlength="80" autocomplete="off"
        /></label>
        <div class="field">
          <span>{{ t('contact.wechatQr') }}</span>
          <img
            v-if="contact.wechatQrId"
            :src="`/api/media/${contact.wechatQrId}`"
            :alt="t('contact.wechatQr')"
            class="wechat-qr-preview"
          />
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            :aria-label="t('contact.wechatQr')"
            :disabled="uploadingWechatQr || busy"
            @change="uploadWechatQr"
          />
          <small>{{ t(uploadingWechatQr ? 'loading' : 'contact.qrHint') }}</small>
          <button
            v-if="contact.wechatQrId"
            type="button"
            class="small-button"
            :disabled="uploadingWechatQr || busy"
            @click="contact.wechatQrId = null"
          >
            {{ t('contact.removeQr') }}
          </button>
        </div>
        <label class="field"
          ><span>{{ t('about.email') }}</span
          ><input v-model="contact.email" type="email" maxlength="254" autocomplete="off"
        /></label>
        <label class="field"
          ><span>{{ t('admin.writingTags') }}</span
          ><input v-model="writingTags" /><small>{{ t('admin.tagHint') }}</small></label
        >
        <h2>{{ t('admin.navigation') }}</h2>
        <label v-for="item in navigation" :key="item.path" class="checkbox"
          ><input
            type="checkbox"
            :checked="form.config.navigation.some((v) => v.path === item.path)"
            @change="toggleNav(item, ($event.target as HTMLInputElement).checked)"
          />{{ t(item.label) }}</label
        >
      </aside>
    </div>
    <SiteDiscoverySettings v-model="form.config" />
  </form>
</template>
