<script setup lang="ts">
import type { ContentKind, SearchResults } from '../../../shared/types'
definePageMeta({ validate: (route) => ['zh', 'en'].includes(String(route.params.locale)) })
const { locale, t, contentUrl } = useSite(),
  route = useRoute()
const term = ref(String(route.query.q || ''))
const query = computed(() => String(route.query.q || '').trim())
const kind = computed(() =>
  ['blog', 'project', 'life'].includes(String(route.query.kind))
    ? (String(route.query.kind) as ContentKind)
    : undefined,
)
const page = computed(() => Math.floor(Math.max(1, Math.min(10000, Number(route.query.page) || 1))))
const filters = ['all', 'blog', 'project', 'life'] as const
const icons = { blog: 'book', project: 'code', life: 'leaf' }
watch(
  () => route.query.q,
  (value) => {
    term.value = String(value || '')
  },
)
const { data, pending, error } = await useAsyncData(
  () => `search:${locale.value}:${query.value}:${kind.value || 'all'}:${page.value}`,
  () =>
    $fetch<SearchResults>('/api/search', {
      query: { locale: locale.value, q: query.value, kind: kind.value, page: page.value },
    }),
)
const filterQuery = (type: string) => ({
  q: query.value || undefined,
  kind: type === 'all' ? undefined : type,
})
const pageQuery = (next: number) => ({ ...filterQuery(kind.value || 'all'), page: next })
useSeoMeta({ title: () => t('search'), robots: 'noindex,follow' })
</script>
<template>
  <header class="page-heading search-heading">
    <p class="eyebrow">EXPLORE THE SITE</p>
    <h1>{{ t('search') }}<i>.</i></h1>
    <p>{{ t('search.subtitle') }}</p>
  </header>
  <form
    class="search-form"
    role="search"
    @submit.prevent="navigateTo({ query: { q: term.trim() || undefined, kind } })"
  >
    <AppIcon name="search" /><input
      v-model="term"
      type="search"
      :placeholder="t('search.hint')"
      :aria-label="t('search')"
      maxlength="200"
    />
    <button class="button primary" :disabled="pending">{{ t('search') }}</button>
  </form>
  <nav class="search-filters" :aria-label="t('search.scope')">
    <NuxtLink
      v-for="type in filters"
      :key="type"
      :to="{ query: filterQuery(type) }"
      :class="{ selected: (kind || 'all') === type }"
      :aria-current="(kind || 'all') === type ? 'page' : undefined"
    >
      <AppIcon v-if="type !== 'all'" :name="icons[type]" :size="15" />{{
        t(type === 'all' ? 'category.all' : `kind.${type}`)
      }}<span>{{ data?.counts[type] ?? '—' }}</span>
    </NuxtLink>
  </nav>
  <div class="search-summary" role="status" aria-live="polite">
    <span>{{ query ? `“${query}”` : t('search.browse') }}</span
    ><span>{{ data?.total ?? 0 }} {{ t('search.results') }}</span>
  </div>
  <div class="search-results" :aria-busy="pending">
    <p v-if="error" class="field-error">{{ t('error.generic') }}</p>
    <template v-else>
      <article v-for="item in data?.items" :key="item.id" class="search-result" :data-kind="item.kind">
        <NuxtLink :to="contentUrl(item)" class="search-result-link">
          <img v-if="item.coverId" :src="`/api/media/${item.coverId}`" alt="" width="64" height="64" />
          <span v-else class="search-result-icon"><AppIcon :name="icons[item.kind]" :size="25" /></span>
          <div>
            <div class="search-result-meta">
              <span>{{ t(`kind.${item.kind}`) }}</span
              ><time>{{ item.publishedAt.slice(0, 10) }}</time>
            </div>
            <h2>{{ item.title }}</h2>
            <p>{{ item.summary }}</p>
          </div>
          <AppIcon name="arrow" :size="18" />
        </NuxtLink>
      </article>
      <p v-if="!data?.items.length" class="empty-state">{{ t('search.empty') }}</p>
    </template>
  </div>
  <nav v-if="data && data.total > data.pageSize" class="pagination" :aria-label="t('search.results')">
    <NuxtLink v-if="page > 1" :to="{ query: pageQuery(page - 1) }">{{ t('previous') }}</NuxtLink>
    <span>{{ page }} / {{ Math.ceil(data.total / data.pageSize) }}</span>
    <NuxtLink v-if="page * data.pageSize < data.total" :to="{ query: pageQuery(page + 1) }">{{
      t('next')
    }}</NuxtLink>
  </nav>
</template>
