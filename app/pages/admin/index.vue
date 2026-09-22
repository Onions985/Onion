<script setup lang="ts">
import type { AdminContent, ContentKind } from '../../../shared/types'
definePageMeta({ layout: 'admin', middleware: 'admin' })
const { t, locale } = useSite(),
  { fail } = useFeedback(),
  kind = ref<ContentKind | ''>('')
const request = useRequestFetch(),
  { data, refresh } = await useAsyncData('admin-content', () =>
    request<{ items: AdminContent[] }>('/api/admin/content'),
  )
const filtered = computed(() => data.value?.items.filter((i) => !kind.value || i.kind === kind.value) || [])
const translation = (item: AdminContent) =>
  item.translations[locale.value] || item.translations.zh || item.translations.en
const pinBusy = ref(false)
const isPublished = (item: AdminContent) =>
  Object.values(item.translations).some((value) => value?.publishedRevisionId)
async function togglePin(item: AdminContent) {
  pinBusy.value = true
  try {
    await apiWrite(`/api/admin/content/${item.id}/pin`, 'PUT', { pinned: !item.pinned })
    await refresh()
  } catch (error) {
    fail(error)
  } finally {
    pinBusy.value = false
  }
}
async function archive(id: string) {
  if (!confirm(t('admin.archiveConfirm'))) return
  try {
    await apiWrite(`/api/admin/content/${id}`, 'DELETE')
    await refresh()
  } catch (e) {
    fail(e)
  }
}
useSeoMeta({ title: () => t('admin.title'), robots: 'noindex,nofollow' })
</script>
<template>
  <div class="admin-heading">
    <div>
      <h1>{{ t('admin.content') }}</h1>
      <p>{{ t('admin.creationHint') }}</p>
      <p class="admin-pin-hint">{{ t('admin.pinHint') }}</p>
    </div>
    <div class="admin-create-actions">
      <NuxtLink to="/admin/edit/new?kind=blog" class="button"
        ><AppIcon name="book" :size="15" />{{ t('admin.newBlog') }}</NuxtLink
      >
      <NuxtLink to="/admin/edit/new?kind=project" class="button"
        ><AppIcon name="code" :size="15" />{{ t('admin.newProject') }}</NuxtLink
      >
      <NuxtLink to="/admin/moments/new" class="button primary"
        ><AppIcon name="plus" :size="15" />{{ t('admin.newMoment') }}</NuxtLink
      >
    </div>
  </div>
  <div class="filters">
    <button :class="{ selected: kind === '' }" @click="kind = ''">{{ t('category.all') }}</button
    ><button
      v-for="value in ['blog', 'project', 'life'] as const"
      :key="value"
      :class="{ selected: kind === value }"
      @click="kind = value"
    >
      {{ t(`kind.${value}`) }}
    </button>
  </div>
  <div v-if="filtered.length" class="admin-list">
    <div v-for="item in filtered" :key="item.id" class="admin-row">
      <AppIcon :name="item.kind === 'blog' ? 'book' : item.kind === 'project' ? 'code' : 'leaf'" />
      <div class="admin-row-title">
        <NuxtLink :to="`/admin/${item.kind === 'life' ? 'moments' : 'edit'}/${item.id}`">{{
          translation(item)?.title
        }}</NuxtLink>
        <div class="meta">
          <ContentPin v-if="item.pinned" />
          <span>{{ t(`kind.${item.kind}`) }}</span
          ><span
            v-for="(value, lang) in item.translations"
            :key="lang"
            class="status-badge"
            :class="{ published: value?.publishedRevisionId }"
            >{{ lang.toUpperCase() }} · {{ t(value?.publishedRevisionId ? 'admin.published' : 'admin.draft')
            }}{{
              value?.publishedRevisionId && value.publishedRevisionId !== value.draftRevisionId ? ' *' : ''
            }}</span
          >
        </div>
      </div>
      <div class="row-actions">
        <button
          class="button"
          :class="{ 'is-pinned': item.pinned }"
          :disabled="pinBusy || (!item.pinned && !isPublished(item))"
          :aria-pressed="item.pinned"
          @click="togglePin(item)"
        >
          <AppIcon name="thumbtack" :size="14" />{{ t(item.pinned ? 'admin.unpin' : 'admin.pin') }}
        </button>
        <NuxtLink :to="`/admin/${item.kind === 'life' ? 'moments' : 'edit'}/${item.id}`" class="button">{{
          t('admin.edit')
        }}</NuxtLink
        ><button class="button" @click="archive(item.id)">{{ t('admin.archive') }}</button>
      </div>
    </div>
  </div>
  <p v-else class="empty-state">{{ t('empty') }}</p>
</template>
