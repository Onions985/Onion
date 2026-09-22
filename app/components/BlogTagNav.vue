<script setup lang="ts">
import type { BlogTags } from '../../shared/types'
const { locale, t, tagUrl, blogTag: active } = useSite()
const route = useRoute()
const browser = ref<HTMLDialogElement>()
const searchInput = ref<HTMLInputElement>()
const resultsPanel = ref<HTMLElement>()
const opened = ref(false)
const query = ref('')
const batchSize = 48
const resultLimit = ref(batchSize)
const visibleLimit = 8
const topicListId = useId()
const { data, error } = await useAsyncData(
  () => `blog-tags:${locale.value}`,
  () => $fetch<BlogTags>('/api/blog-tags', { query: { locale: locale.value } }),
)
const tags = computed(() => {
  const values = data.value?.tags || []
  return active.value && !values.some((tag) => tag.name === active.value)
    ? [...values, { name: active.value, count: 0 }]
    : values
})
// 少见标签的独立页面仍保留当前选项，避免折叠后失去浏览位置。
const collapsedTags = computed(() => {
  const popular = tags.value.slice(0, visibleLimit)
  const current = tags.value.find((tag) => tag.name === active.value)
  return current && !popular.includes(current) ? [...popular, current] : popular
})
const hiddenCount = computed(() => tags.value.length - collapsedTags.value.length)
const filteredTags = computed(() => {
  const terms = query.value.normalize('NFKC').trim().toLocaleLowerCase().split(/\s+/).filter(Boolean)
  return tags.value.filter((tag) =>
    terms.every((term) => tag.name.normalize('NFKC').toLocaleLowerCase().includes(term)),
  )
})
const results = computed(() => filteredTags.value.slice(0, resultLimit.value))
watch(query, () => {
  resultLimit.value = batchSize
  resultsPanel.value?.scrollTo({ top: 0 })
})
async function loadMore() {
  const firstNewIndex = resultLimit.value
  resultLimit.value += batchSize
  await nextTick()
  const firstNewLink = resultsPanel.value?.querySelectorAll<HTMLAnchorElement>('a')[firstNewIndex]
  firstNewLink?.focus({ preventScroll: true })
  firstNewLink?.scrollIntoView({ block: 'nearest' })
}
function openBrowser() {
  query.value = ''
  resultLimit.value = batchSize
  browser.value?.showModal()
  opened.value = true
  searchInput.value?.focus({ preventScroll: true })
  resultsPanel.value?.scrollTo({ top: 0 })
}
function closeBrowser() {
  browser.value?.close()
  opened.value = false
}
function clearSearch() {
  query.value = ''
  searchInput.value?.focus()
}
function closeOnBackdrop(event: MouseEvent) {
  if (event.target !== browser.value) return
  const bounds = browser.value.getBoundingClientRect()
  if (
    event.clientX < bounds.left ||
    event.clientX > bounds.right ||
    event.clientY < bounds.top ||
    event.clientY > bounds.bottom
  )
    closeBrowser()
}
watch(() => route.fullPath, closeBrowser)
onBeforeUnmount(closeBrowser)
</script>
<template>
  <nav class="blog-topics" :aria-label="t('writing.tags')">
    <div class="topic-heading">
      <p>{{ t('writing.tags') }}</p>
      <button
        v-if="hiddenCount > 0"
        type="button"
        class="topic-toggle"
        aria-haspopup="dialog"
        :aria-expanded="opened"
        :aria-controls="topicListId"
        @click="openBrowser"
      >
        <AppIcon name="search" :size="14" />{{ t('writing.browseTags') }}<span>{{ tags.length }}</span>
        <AppIcon name="right" :size="14" />
      </button>
    </div>
    <div class="topic-links">
      <NuxtLink
        :to="`/${locale}/writing`"
        :class="{ selected: !active }"
        :aria-current="!active ? 'page' : undefined"
        >{{ t('category.all') }}<span v-if="data">{{ data.total }}</span></NuxtLink
      >
      <NuxtLink
        v-for="tag in collapsedTags"
        :key="tag.name"
        :to="tagUrl(tag.name)"
        :class="{ selected: active === tag.name }"
        :aria-current="active === tag.name ? 'page' : undefined"
        >{{ tag.name }}<span>{{ tag.count }}</span></NuxtLink
      >
    </div>
    <p v-if="error" class="field-error">{{ t('error.generic') }}</p>
    <dialog
      :id="topicListId"
      ref="browser"
      class="tag-browser"
      :aria-labelledby="`${topicListId}-title`"
      :aria-describedby="`${topicListId}-hint`"
      @close="opened = false"
      @click="closeOnBackdrop"
    >
      <div class="tag-browser-header">
        <div>
          <h2 :id="`${topicListId}-title`">
            {{ t('writing.browseTags') }}<span>{{ tags.length }}</span>
          </h2>
          <p :id="`${topicListId}-hint`">{{ t('writing.tagsHint') }}</p>
        </div>
        <button
          type="button"
          class="tag-browser-close"
          :aria-label="t('writing.closeTags')"
          @click="closeBrowser"
        >
          <AppIcon name="close" :size="20" />
        </button>
      </div>
      <div class="tag-search">
        <AppIcon name="search" :size="19" />
        <input
          ref="searchInput"
          v-model="query"
          type="search"
          :placeholder="t('writing.searchTags')"
          :aria-label="t('writing.searchTags')"
          :aria-controls="`${topicListId}-results`"
          autocomplete="off"
          spellcheck="false"
        />
        <button
          v-if="query"
          type="button"
          :aria-label="t('writing.clearTagSearch')"
          @click="clearSearch"
        >
          <AppIcon name="close" :size="16" />
        </button>
      </div>
      <div class="tag-results-heading">
        <span>{{ query.trim() ? t('writing.matchingTags') : t('writing.popularTags') }}</span>
        <span role="status" aria-live="polite">{{ filteredTags.length }} {{ t(filteredTags.length === 1 ? 'writing.tagSingular' : 'writing.tagUnit') }}</span>
      </div>
      <div :id="`${topicListId}-results`" ref="resultsPanel" class="tag-results">
        <div v-if="results.length" class="tag-result-grid">
          <NuxtLink
            v-for="tag in results"
            :key="tag.name"
            :to="tagUrl(tag.name)"
            :class="{ selected: active === tag.name }"
            :aria-current="active === tag.name ? 'page' : undefined"
            @click="closeBrowser"
            ><span class="tag-result-name"><i aria-hidden="true">#</i>{{ tag.name }}</span
            ><span class="tag-result-count"
              >{{ tag.count }}<AppIcon v-if="active === tag.name" name="check" :size="13" /></span
          ></NuxtLink>
        </div>
        <div v-else class="tag-search-empty">
          <AppIcon name="search" :size="26" />
          <p>{{ t('writing.noMatchingTags') }}</p>
        </div>
        <button
          v-if="filteredTags.length > resultLimit"
          class="tag-load-more"
          type="button"
          @click="loadMore"
        >
          {{ t('writing.loadTags') }}<AppIcon name="chevron" :size="14" />
        </button>
      </div>
      <footer class="tag-browser-footer">
        <NuxtLink :to="`/${locale}/writing`" @click="closeBrowser"
          >{{ t('writing.allPosts') }}<AppIcon name="right" :size="14" /></NuxtLink
        ><span>{{ t('writing.escapeHint') }}</span>
      </footer>
    </dialog>
  </nav>
</template>
