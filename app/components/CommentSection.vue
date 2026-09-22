<script setup lang="ts">
import type { CommentItem } from '../../shared/types'
const props = defineProps<{ contentId: string }>(),
  { t } = useSite(),
  { fail } = useFeedback()
const page = ref(1),
  name = ref(''),
  body = ref(''),
  busy = ref(false),
  sent = ref(false),
  replyTo = ref<CommentItem | null>(null)
const { data, refresh, error } = await useAsyncData(
  () => `comments:${props.contentId}:${page.value}`,
  () =>
    $fetch<{ items: CommentItem[]; total: number; pageSize: number }>('/api/comments', {
      query: { contentId: props.contentId, page: page.value },
    }),
)
const roots = computed(() => data.value?.items.filter((item) => !item.parentId) || [])
const replies = (id: string) => data.value?.items.filter((item) => item.parentId === id) || []
const form = useTemplateRef('form')
function reply(comment: CommentItem) {
  replyTo.value = comment
  form.value?.scrollIntoView({ block: 'center', behavior: 'instant' })
}
async function submit() {
  busy.value = true
  sent.value = false
  try {
    const result = await apiWrite<{ status: string }>('/api/comments', 'POST', {
      contentId: props.contentId,
      parentId: replyTo.value?.id || null,
      authorName: name.value,
      body: body.value,
    })
    body.value = ''
    replyTo.value = null
    sent.value = result.status === 'pending'
    page.value = 1
    await refresh()
  } catch (e) {
    fail(e)
  } finally {
    busy.value = false
  }
}
</script>
<template>
  <section class="comments-section">
    <div class="section-heading">
      <h2>
        {{ t('comments.title') }}<span v-if="data?.total" class="comment-count">{{ data.total }}</span>
      </h2>
    </div>
    <p class="editor-help">{{ t('comments.hint') }}</p>
    <form ref="form" class="comment-form" @submit.prevent="submit">
      <div v-if="replyTo" class="reply-indicator">
        {{ t('comments.replyTo') }} {{ replyTo.authorName
        }}<button type="button" @click="replyTo = null">{{ t('comments.cancel') }}</button>
      </div>
      <label class="field"
        ><span>{{ t('comments.name') }}</span
        ><input
          v-model="name"
          required
          maxlength="40"
          autocomplete="nickname"
          :placeholder="t('comments.namePlaceholder')"
      /></label>
      <CommentInput
        v-model="body"
        :label="t('comments.body')"
        :placeholder="t('comments.placeholder')"
        :disabled="busy"
      >
        <button class="button primary" :disabled="busy">
          {{ t(busy ? 'loading' : 'comments.submit') }}<AppIcon name="right" :size="14" />
        </button>
      </CommentInput>
      <p v-if="sent" role="status" class="comment-sent">
        <AppIcon name="check" :size="15" />{{ t('comments.pendingMessage') }}
      </p>
    </form>
    <p v-if="error" class="form-error">{{ t('error.generic') }}</p>
    <div class="comment-list">
      <div v-for="comment in roots" :key="comment.id" class="comment">
        <CommentAvatar :is-author="Boolean(comment.isAuthor)" :name="comment.authorName" />
        <div class="comment-content">
          <div class="comment-heading">
            <strong>{{ comment.authorName }}</strong
            ><span v-if="comment.isAuthor" class="author-badge">{{ t('comments.author') }}</span
            ><time>{{ comment.createdAt.slice(0, 16) }}</time>
          </div>
          <p>{{ comment.body }}</p>
          <button class="small-button" @click="reply(comment)">{{ t('comments.reply') }}</button>
          <div v-for="child in replies(comment.id)" :key="child.id" class="comment-reply">
            <CommentAvatar :is-author="Boolean(child.isAuthor)" :name="child.authorName" compact />
            <div class="comment-content">
              <div class="comment-heading">
                <strong>{{ child.authorName }}</strong
                ><span v-if="child.isAuthor" class="author-badge">{{ t('comments.author') }}</span
                ><time>{{ child.createdAt.slice(0, 16) }}</time>
              </div>
              <p>{{ child.body }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
    <p v-if="!error && !roots.length" class="comments-empty">{{ t('comments.empty') }}</p>
    <nav v-if="data && data.total > data.pageSize" class="pagination">
      <button class="small-button" :disabled="page === 1" @click="page--">{{ t('previous') }}</button
      ><span>{{ page }} / {{ Math.ceil(data.total / data.pageSize) }}</span
      ><button class="small-button" :disabled="page * data.pageSize >= data.total" @click="page++">
        {{ t('next') }}
      </button>
    </nav>
  </section>
</template>
