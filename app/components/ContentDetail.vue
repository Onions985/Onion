<script setup lang="ts">
import type { ContentDetail, ContentKind } from '../../shared/types'
const props = defineProps<{ kind: ContentKind }>(),
  route = useRoute(),
  { site, locale, t, translations, contentUrl } = useSite()
const section = computed(() =>
  props.kind === 'blog' ? 'writing' : props.kind === 'project' ? 'projects' : 'life',
)
const { data, error } = await useAsyncData(
  () => `detail:${props.kind}:${locale.value}:${route.params.slug}`,
  () =>
    $fetch<ContentDetail>(`/api/content/${encodeURIComponent(String(route.params.slug))}`, {
      query: { locale: locale.value, kind: props.kind },
    }),
)
if (error.value)
  throw createError({ statusCode: error.value.statusCode || 404, statusMessage: 'Content not found' })
watch(data, (value) => (translations.value = value?.translations || []), { immediate: true })
onBeforeUnmount(() => (translations.value = []))
useSeoMeta({
  title: () => data.value?.title,
  description: () => data.value?.summary,
  ogTitle: () => data.value?.title,
  ogDescription: () => data.value?.summary,
  ogType: 'article',
})
</script>
<template>
  <article v-if="data" class="detail" :class="`detail--${kind}`">
    <NuxtLink class="back-link" :to="`/${locale}/${section}`"
      ><AppIcon name="left" :size="15" />{{ t(`nav.${section}`) }}</NuxtLink
    >
    <ContentPin v-if="data.pinned" class="detail-pin" />
    <template v-if="kind === 'project'">
      <header class="project-detail-hero" :class="{ 'is-flagship': data.metadata.flagship }">
        <div>
          <span v-if="data.metadata.flagship" class="work-flagship">{{ t('project.flagship') }}</span>
          <div class="work-kicker">
            <span>{{ data.metadata.category || t('kind.project') }}</span
            ><span v-if="data.metadata.projectStatus" class="work-status"
              ><i />{{ data.metadata.projectStatus }}</span
            >
          </div>
          <h1>{{ data.title }}</h1>
          <p>{{ data.summary }}</p>
          <div class="work-stack">
            <span v-for="tech in data.metadata.technologies" :key="tech">{{ tech }}</span>
          </div>
        </div>
        <ProjectArtwork :item="data" />
      </header>
      <div class="project-detail-layout">
        <ProjectPresentation :item="data" />
      </div>
    </template>
    <template v-else-if="kind === 'life'">
      <section class="moment-detail-card">
        <header class="moment-detail-header">
          <MomentByline
            :date="data.metadata.occurredOn || data.publishedAt"
            :location="data.metadata.location"
          />
          <h1 :class="{ 'sr-only': Boolean(data.metadata.moment) }">
            {{ data.metadata.moment ? t('nav.life') : data.title }}
          </h1>
          <p
            v-if="!data.metadata.moment && data.summary && data.summary !== data.title"
            class="moment-detail-summary"
          >
            {{ data.summary }}
          </p>
        </header>
        <div v-if="data.metadata.moment?.text || !data.metadata.moment" class="moment-detail-text">
          <p v-if="data.metadata.moment?.text" class="moment-status-text">{{ data.metadata.moment.text }}</p>
          <div v-else class="prose" v-html="data.html" />
        </div>
        <MomentGallery
          :images="data.metadata.moment?.imageIds || (data.coverId ? [data.coverId] : [])"
          detail
        />
        <footer class="moment-card-footer">
          <div v-if="data.metadata.tags.length" class="moment-topics">
            <span v-for="tag in data.metadata.tags" :key="tag"># {{ tag }}</span>
          </div>
          <span v-else class="moment-category"><AppIcon name="leaf" :size="15" />{{ t('nav.life') }}</span>
          <span class="moment-signature">{{ site?.profile.displayName }}</span>
        </footer>
      </section>
    </template>
    <template v-else>
      <header class="detail-header reading-header">
        <div class="meta">
          <span class="pill">{{ data.metadata.category || t('kind.blog') }}</span
          ><span>{{ data.readingMinutes }} {{ t('minutes') }}</span>
        </div>
        <h1>{{ data.title }}</h1>
        <p class="detail-summary">{{ data.summary }}</p>
        <div class="reading-byline">
          <OnionLogo :size="25" /><span>{{ site?.profile.displayName }}</span
          ><time>{{ data.publishedAt.slice(0, 10) }}</time>
        </div>
        <div v-if="data.translations.length > 1" class="translations">
          {{ t('translations')
          }}<NuxtLink
            v-for="translation in data.translations.filter((i) => i.locale !== locale)"
            :key="translation.locale"
            :to="contentUrl({ ...data, slug: translation.slug }, translation.locale)"
            >{{ translation.locale === 'zh' ? '中文' : 'English' }} ↗</NuxtLink
          >
        </div>
      </header>
      <img v-if="data.coverId" :src="`/api/media/${data.coverId}`" :alt="data.title" class="detail-cover" />
      <div class="prose" v-html="data.html" />
    </template>
    <BlogTagLinks v-if="kind === 'blog'" :tags="data.metadata.tags" class="detail-tags" />
    <div v-else-if="kind !== 'life'" class="tags detail-tags">
      <span v-for="tag in data.metadata.tags" :key="tag"># {{ tag }}</span>
    </div>
    <CommentSection :content-id="data.id" />
  </article>
</template>
