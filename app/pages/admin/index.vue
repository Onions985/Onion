<script setup lang="ts">
import type { AdminContentPage, AdminContentSummary, ContentKind } from '../../../shared/types'
definePageMeta({ layout: 'admin', middleware: 'admin' })
const { t, locale } = useSite(),
  { fail } = useFeedback(),
  route = useRoute(),
  router = useRouter()
const kind = computed<ContentKind | ''>(() =>
  ['blog', 'project', 'life'].includes(String(route.query.kind)) ? (route.query.kind as ContentKind) : '',
)
const page = computed(() => Math.floor(Math.max(1, Math.min(10000, Number(route.query.page) || 1)))),
  query = computed(() => (typeof route.query.q === 'string' ? route.query.q.trim().slice(0, 200) : '')),
  search = ref(query.value)
watch(query, (value) => {
  search.value = value
})
const request = useRequestFetch(),
  { data, refresh, status, error } = await useAsyncData(
    () => `admin-content:${kind.value}:${query.value}:${page.value}`,
    () =>
      request<AdminContentPage>('/api/admin/content', {
        query: { kind: kind.value || undefined, q: query.value || undefined, page: page.value },
      }),
  )
const busy = ref(false),
  pending = computed(() => status.value === 'pending'),
  pages = computed(() => Math.max(1, Math.ceil((data.value?.total || 0) / (data.value?.pageSize || 20))))
function listQuery(nextPage: number, nextKind = kind.value, nextSearch = query.value) {
  return {
    ...route.query,
    kind: nextKind || undefined,
    q: nextSearch || undefined,
    page: nextPage > 1 ? nextPage : undefined,
  }
}
function filterKind(value: ContentKind | '') {
  return router.push({ query: listQuery(1, value) })
}
function submitSearch() {
  return router.push({ query: listQuery(1, kind.value, search.value.trim().slice(0, 200)) })
}
function clearSearch() {
  search.value = ''
  return submitSearch()
}
// Archiving the final item on a page can reduce the last available page.
watch(
  data,
  (value) => {
    if (value && value.page !== page.value) void router.replace({ query: listQuery(value.page) })
  },
  { immediate: true },
)
const translation = (item: AdminContentSummary) =>
  item.translations[locale.value] || item.translations.zh || item.translations.en
const isPublished = (item: AdminContentSummary) =>
  Object.values(item.translations).some((value) => value?.publishedRevisionId)
async function togglePin(item: AdminContentSummary) {
  busy.value = true
  try {
    await apiWrite(`/api/admin/content/${item.id}/pin`, 'PUT', { pinned: !item.pinned })
    await refresh()
  } catch (error) {
    fail(error)
  } finally {
    busy.value = false
  }
}
async function archive(id: string) {
  if (!confirm(t('admin.archiveConfirm'))) return
  busy.value = true
  try {
    await apiWrite(`/api/admin/content/${id}`, 'DELETE')
    await refresh()
  } catch (e) {
    fail(e)
  } finally {
    busy.value = false
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
  <form class="admin-content-search" role="search" @submit.prevent="submitSearch">
    <input
      v-model="search"
      type="search"
      maxlength="200"
      :aria-label="t('admin.contentSearch')"
      :placeholder="t('admin.contentSearch')"
    />
    <button class="button primary" type="submit">{{ t('admin.search') }}</button>
    <button v-if="query || search" class="button" type="button" @click="clearSearch">
      {{ t('admin.clearSearch') }}
    </button>
  </form>
  <div class="filters">
    <button :class="{ selected: kind === '' }" @click="filterKind('')">{{ t('category.all') }}</button
    ><button
      v-for="value in ['blog', 'project', 'life'] as const"
      :key="value"
      :class="{ selected: kind === value }"
      @click="filterKind(value)"
    >
      {{ t(`kind.${value}`) }}
    </button>
  </div>
  <p v-if="error" class="empty-state" role="alert">
    {{ t('admin.loadFailed') }} <button class="button" @click="refresh()">{{ t('admin.retry') }}</button>
  </p>
  <p v-else-if="pending" class="empty-state" role="status">{{ t('loading') }}</p>
  <template v-else>
    <p v-if="data" class="admin-content-count" role="status">
      {{
        t('admin.contentTotal')
          .replace('{total}', String(data.total))
          .replace('{size}', String(data.pageSize))
      }}
    </p>
    <div v-if="data?.items.length" class="admin-list">
      <div v-for="item in data.items" :key="item.id" class="admin-row">
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
              >{{ lang.toUpperCase() }} ·
              {{ t(value?.publishedRevisionId ? 'admin.published' : 'admin.draft')
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
            :disabled="busy || (!item.pinned && !isPublished(item))"
            :aria-pressed="item.pinned"
            @click="togglePin(item)"
          >
            <AppIcon name="thumbtack" :size="14" />{{ t(item.pinned ? 'admin.unpin' : 'admin.pin') }}
          </button>
          <NuxtLink :to="`/admin/${item.kind === 'life' ? 'moments' : 'edit'}/${item.id}`" class="button">{{
            t('admin.edit')
          }}</NuxtLink
          ><button class="button" :disabled="busy" @click="archive(item.id)">{{ t('admin.archive') }}</button>
        </div>
      </div>
    </div>
    <p v-else class="empty-state">{{ t('admin.noContent') }}</p>
    <nav v-if="data && pages > 1" class="pagination" :aria-label="t('admin.contentPagination')">
      <button
        class="small-button"
        :disabled="busy || data.page === 1"
        @click="router.push({ query: listQuery(data.page - 1) })"
      >
        {{ t('previous') }}
      </button>
      <span>{{ data.page }} / {{ pages }}</span>
      <button
        class="small-button"
        :disabled="busy || data.page >= pages"
        @click="router.push({ query: listQuery(data.page + 1) })"
      >
        {{ t('next') }}
      </button>
    </nav>
  </template>
</template>
<style scoped>
.admin-content-search {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 20px;
}
.admin-content-search input {
  flex: 1 1 260px;
  min-width: 0;
  width: auto;
  padding: 11px 14px;
  border: 1px solid var(--line);
  border-radius: 9px;
  background: var(--surface);
  color: var(--fg);
  font: inherit;
}
.admin-content-count {
  margin: 0 0 16px;
  color: var(--muted);
  font-size: 13px;
}
</style>
