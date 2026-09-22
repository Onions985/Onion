<script setup lang="ts">
import type { CommentItem } from '../../../shared/types'
definePageMeta({ layout: 'admin', middleware: 'admin' })
const { t } = useSite(),
  { notify, fail } = useFeedback(),
  request = useRequestFetch(),
  status = ref('pending'),
  page = ref(1),
  busy = ref(false),
  replyId = ref(''),
  replyBody = ref('')
watch(status, () => (page.value = 1))
const { data, refresh } = await useAsyncData(
  () => `admin-comments:${status.value}:${page.value}`,
  () =>
    request<{ items: CommentItem[]; total: number; pageSize: number }>('/api/admin/comments', {
      query: { status: status.value, page: page.value },
    }),
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
  <div class="filters">
    <button
      v-for="value in ['pending', 'approved', 'hidden', '']"
      :key="value"
      :class="{ selected: status === value }"
      @click="status = value"
    >
      {{ value ? t(`comments.${value}`) : t('category.all') }}
    </button>
  </div>
  <div class="moderation-list">
    <article v-for="comment in data?.items" :key="comment.id" class="moderation-card">
      <div class="comment-heading">
        <CommentAvatar :is-author="Boolean(comment.isAuthor)" :name="comment.authorName" compact />
        <strong>{{ comment.authorName }}</strong
        ><span v-if="comment.isAuthor" class="author-badge">{{ t('comments.author') }}</span
        ><span class="status-badge">{{ t(`comments.${comment.status}`) }}</span
        ><time>{{ comment.createdAt.slice(0, 16) }}</time>
      </div>
      <NuxtLink class="comment-source" :to="`/admin/edit/${comment.contentId}`"
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
  <p v-if="!data?.items.length" class="empty-state">{{ t('comments.empty') }}</p>
  <nav v-if="data && data.total > data.pageSize" class="pagination">
    <button class="small-button" :disabled="page === 1" @click="page--">{{ t('previous') }}</button
    ><span>{{ page }} / {{ Math.ceil(data.total / data.pageSize) }}</span
    ><button class="small-button" :disabled="page * data.pageSize >= data.total" @click="page++">
      {{ t('next') }}
    </button>
  </nav>
</template>
