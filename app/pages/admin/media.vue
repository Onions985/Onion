<script setup lang="ts">
import type { MediaAsset } from '../../../shared/types'
definePageMeta({ layout: 'admin', middleware: 'admin' })
const { t } = useSite(),
  { notify, fail } = useFeedback(),
  busy = ref(false),
  request = useRequestFetch()
const { data, refresh } = await useAsyncData('admin-media', () =>
  request<{ items: MediaAsset[] }>('/api/admin/media'),
)
async function upload(event: Event) {
  const input = event.target as HTMLInputElement
  if (!input.files?.length) return
  busy.value = true
  try {
    for (const file of input.files) {
      const body = new FormData()
      body.append('file', file)
      await apiWrite('/api/admin/media', 'POST', body)
    }
    await refresh()
    notify(t('admin.saved'))
  } catch (e) {
    fail(e)
  } finally {
    busy.value = false
    input.value = ''
  }
}
async function copy(url: string) {
  try {
    await navigator.clipboard.writeText(url)
    notify(t('admin.copied'))
  } catch (e) {
    fail(e)
  }
}
useSeoMeta({ title: () => t('admin.media'), robots: 'noindex,nofollow' })
</script>
<template>
  <div class="admin-heading">
    <div>
      <h1>{{ t('admin.media') }}</h1>
      <p>{{ t('admin.mediaHelp') }}</p>
    </div>
    <label class="button primary upload-button"
      ><AppIcon name="plus" :size="15" />{{ t(busy ? 'loading' : 'admin.upload')
      }}<input
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        multiple
        :disabled="busy"
        :aria-label="t('admin.upload')"
        @change="upload"
    /></label>
  </div>
  <p class="editor-help">{{ t('admin.privateMedia') }}</p>
  <div class="media-grid">
    <div v-for="asset in data?.items" :key="asset.id" class="media-card">
      <img :src="asset.url" :alt="asset.originalName" loading="lazy" />
      <div>
        <p>{{ asset.originalName }}</p>
        <small>{{ asset.width }} × {{ asset.height }} · {{ Math.ceil(asset.size / 1024) }} KB</small
        ><button class="small-button" @click="copy(asset.url)">{{ t('admin.copy') }}</button>
      </div>
    </div>
  </div>
  <p v-if="!data?.items.length" class="empty-state">{{ t('empty') }}</p>
</template>
