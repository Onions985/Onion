<script setup lang="ts">
import type { ContentKind, ContentSummary } from '../../shared/types'
import WritingCollection from './WritingCollection.vue'
import ProjectCollection from './ProjectCollection.vue'
import LifeCollection from './LifeCollection.vue'
const collections = { blog: WritingCollection, project: ProjectCollection, life: LifeCollection }
const props = defineProps<{ kind: ContentKind }>(),
  { locale, t, blogTag } = useSite(),
  route = useRoute()
const page = computed(() => Math.floor(Math.max(1, Math.min(10000, Number(route.query.page) || 1))))
const tag = computed(() => (props.kind === 'blog' ? blogTag.value : ''))
const section = computed(() =>
  props.kind === 'blog' ? 'writing' : props.kind === 'project' ? 'projects' : 'life',
)
const { data, error } = await useAsyncData(
  () => `list:${props.kind}:${locale.value}:${page.value}:${tag.value}`,
  () =>
    $fetch<{ items: ContentSummary[]; total: number; pageSize: number }>('/api/content', {
      query: { kind: props.kind, locale: locale.value, page: page.value, tag: tag.value || undefined },
    }),
)
useSeoMeta({
  title: () => (tag.value ? `# ${tag.value} · ${t('nav.writing')}` : t(`nav.${section.value}`)),
  description: () => t(`${section.value}.subtitle`),
})
</script>
<template>
  <component
    :is="collections[kind]"
    :items="error ? [] : data?.items || []"
    :total="data?.total || 0"
    :page="page"
  >
    <p v-if="error" class="empty-state">{{ t('error.generic') }}</p>
    <p v-else-if="!data?.items.length" class="empty-state">{{ t(tag ? 'writing.tagEmpty' : 'empty') }}</p>
  </component>
  <nav v-if="data && data.total > data.pageSize" class="pagination">
    <NuxtLink v-if="page > 1" :to="{ query: { ...route.query, page: page - 1 } }"
      >← {{ t('previous') }}</NuxtLink
    ><span>{{ page }} / {{ Math.ceil(data.total / data.pageSize) }}</span
    ><NuxtLink v-if="page * data.pageSize < data.total" :to="{ query: { ...route.query, page: page + 1 } }"
      >{{ t('next') }} →</NuxtLink
    >
  </nav>
</template>
