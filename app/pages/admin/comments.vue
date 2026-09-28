<script setup lang="ts">
import type { AdminCommentsPage } from '../../../shared/types'
definePageMeta({ layout: 'admin', middleware: 'admin' })
const { t } = useSite(),
  { notify, fail } = useFeedback(),
  request = useRequestFetch(),
  route = useRoute(),
  router = useRouter(),
  busy = ref(false),
  replyId = ref(''),
  replyBody = ref('')
const status = computed(() =>
    typeof route.query.status === 'string' &&
    ['pending', 'approved', 'hidden', ''].includes(route.query.status)
      ? route.query.status
      : 'pending',
  ),
  page = computed(() => Math.floor(Math.max(1, Math.min(10000, Number(route.query.page) || 1)))),
  query = computed(() => (typeof route.query.q === 'string' ? route.query.q.trim().slice(0, 200) : '')),
  search = ref(query.value)
watch(query, (value) => {
  search.value = value
})
const {
  data,
  refresh,
  status: loadStatus,
  error,
} = await useAsyncData(
  () => `admin-comments:${status.value}:${query.value}:${page.value}`,
  () =>
    request<AdminCommentsPage>('/api/admin/comments', {
      query: { status: status.value, q: query.value || undefined, page: page.value },
    }),
)
const pages = computed(() => Math.max(1, Math.ceil((data.value?.total || 0) / (data.value?.pageSize || 30))))
function listQuery(nextPage: number, nextStatus = status.value, nextSearch = query.value) {
  return {
    ...route.query,
    status: nextStatus === 'pending' ? undefined : nextStatus,
    q: nextSearch || undefined,
    page: nextPage > 1 ? nextPage : undefined,
  }
}
function submitSearch() {
  return router.push({ query: listQuery(1, status.value, search.value.trim().slice(0, 200)) })
}
function clearSearch() {
  search.value = ''
  return submitSearch()
}
// Approving or hiding the last match can remove the final page of a status filter.
watch(
  data,
  (value) => {
    if (value && value.page !== page.value) void router.replace({ query: listQuery(value.page) })
  },
  { immediate: true },
)
async function moderate(id: string, value: string) {
  busy.value = true
  try {
    await apiWrite(`/api/admin/comments/${id}`, 'PUT', { status: value })
    await refresh()
    notify(t('admin.saved'))
  } catch (e) {
    fail(e)
  } finally {
    busy.value = false
  }
}
async function reply() {
  busy.value = true
  try {
    await apiWrite(`/api/admin/comments/${replyId.value}/reply`, 'POST', { body: replyBody.value })
    replyId.value = ''
    replyBody.value = ''
    await refresh()
    notify(t('admin.saved'))
  } catch (e) {
    fail(e)
  } finally {
    busy.value = false
  }
}
useSeoMeta({ title: () => t('admin.comments'), robots: 'noindex,nofollow' })
</script>
<template>
  <div class="admin-heading">
    <div>
      <h1>{{ t('admin.comments') }}</h1>
      <p>{{ t('comments.moderationHint') }}</p>
    </div>
  </div>
  <form class="admin-comment-search" role="search" @submit.prevent="submitSearch">
    <input
      v-model="search"
      type="search"
      maxlength="200"
      :aria-label="t('comments.search')"
      :placeholder="t('comments.search')"
    />
    <button class="button primary" type="submit">{{ t('admin.search') }}</button>
    <button v-if="query || search" class="button" type="button" @click="clearSearch">
      {{ t('admin.clearSearch') }}
    </button>
  </form>
  <div class="filters">
    <button
      v-for="value in ['pending', 'approved', 'hidden', '']"
      :key="value"
      :class="{ selected: status === value }"
      @click="router.push({ query: listQuery(1, value) })"
    >
      {{ value ? t(`comments.${value}`) : t('category.all') }}
    </button>
  </div>
  <p v-if="error" class="empty-state" role="alert">
    {{ t('comments.loadFailed') }} <button class="button" @click="refresh()">{{ t('admin.retry') }}</button>
  </p>
  <p v-else-if="loadStatus === 'pending'" class="empty-state" role="status">{{ t('loading') }}</p>
  <template v-else>
    <p v-if="data" class="admin-comment-count" role="status">
      {{
        t('comments.total').replace('{total}', String(data.total)).replace('{size}', String(data.pageSize))
      }}
    </p>
    <div class="moderation-list">
      <article v-for="comment in data?.items" :key="comment.id" class="moderation-card">
        <div class="comment-heading">
          <CommentAvatar :is-author="Boolean(comment.isAuthor)" :name="comment.authorName" compact />
          <strong>{{ comment.authorName }}</strong
          ><span v-if="comment.isAuthor" class="author-badge">{{ t('comments.author') }}</span
          ><span class="status-badge">{{ t(`comments.${comment.status}`) }}</span
          ><time>{{ comment.createdAt.slice(0, 16) }}</time>
        </div>
        <NuxtLink
          class="comment-source"
          :to="`/admin/${comment.kind === 'life' ? 'moments' : 'edit'}/${comment.contentId}`"
          >{{ t(`kind.${comment.kind}`) }} · {{ comment.contentTitle }}</NuxtLink
        >
        <p class="comment-body">{{ comment.body }}</p>
        <div class="row-actions">
          <button
            v-if="comment.status !== 'approved'"
            class="button"
            :disabled="busy"
            @click="moderate(comment.id, 'approved')"
          >
            {{ t('comments.approve') }}</button
          ><button
            v-if="comment.status !== 'hidden'"
            class="button"
            :disabled="busy"
            @click="moderate(comment.id, 'hidden')"
          >
            {{ t('comments.hide') }}</button
          ><button
            v-if="comment.status === 'approved'"
            class="button"
            :disabled="busy"
            @click="replyId = replyId === comment.id ? '' : comment.id"
          >
            {{ t('comments.reply') }}
          </button>
        </div>
        <form v-if="replyId === comment.id" class="moderator-reply" @submit.prevent="reply">
          <CommentInput v-model="replyBody" :label="t('comments.authorReply')" :rows="3" :disabled="busy">
            <button class="button primary" :disabled="busy">{{ t('comments.submit') }}</button>
          </CommentInput>
        </form>
      </article>
    </div>
    <p v-if="!data?.items.length" class="empty-state">
      {{ t(query ? 'comments.noMatches' : 'comments.empty') }}
    </p>
    <nav v-if="data && pages > 1" class="pagination" :aria-label="t('comments.pagination')">
      <button
        class="small-button"
        :disabled="busy || data.page === 1"
        @click="router.push({ query: listQuery(data.page - 1) })"
      >
        {{ t('previous') }}</button
      ><span>{{ data.page }} / {{ pages }}</span
      ><button
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
.admin-comment-search {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 20px;
}
.admin-comment-search input {
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
.admin-comment-count {
  margin: 0 0 16px;
  color: var(--muted);
  font-size: 13px;
}
</style>
