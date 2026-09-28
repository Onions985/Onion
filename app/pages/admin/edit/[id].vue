<script setup lang="ts">
import type { AdminContent, BlogTags, ContentKind, Locale, TranslationDraft } from '../../../../shared/types'
import { metadataSchema } from '#shared/validation'
definePageMeta({ layout: 'admin', middleware: 'admin', key: (route) => String(route.params.id) })
const route = useRoute(),
  { locale, t, contentUrl } = useSite(),
  { notify, fail } = useFeedback(),
  request = useRequestFetch()
const isNew = route.params.id === 'new',
  kind = ref<ContentKind>(route.query.kind === 'project' ? 'project' : 'blog'),
  contentLocale = ref<Locale>('zh'),
  busy = ref(false)
const { data: initial } = await useAsyncData(
  () => `admin-edit:${route.params.id}`,
  () => (isNew ? Promise.resolve(null) : request<AdminContent>(`/api/admin/content/${route.params.id}`)),
)
if (!isNew && !initial.value) throw createError({ statusCode: 404, statusMessage: 'Content not found' })
const record = ref<AdminContent | null>(initial.value || null)
if (record.value) kind.value = record.value.kind
if (kind.value === 'life' || (isNew && route.query.kind === 'life'))
  await navigateTo(`/admin/moments/${route.params.id}`, { replace: true })
watch(
  kind,
  (value) => {
    if (value !== 'blog') contentLocale.value = 'zh'
  },
  { immediate: true },
)
const blank = (lang: Locale): TranslationDraft => ({
  locale: lang,
  slug: '',
  title: '',
  summary: '',
  markdown: '',
  coverId: null,
  metadata: metadataSchema.parse({}),
  version: 0,
  draftRevisionId: null,
  publishedRevisionId: null,
  publishedAt: null,
})
const drafts = reactive<Record<Locale, TranslationDraft>>({
  zh: structuredClone(toRaw(record.value?.translations.zh) || blank('zh')),
  en: structuredClone(toRaw(record.value?.translations.en) || blank('en')),
})
const snapshots = reactive({ zh: JSON.stringify(drafts.zh), en: JSON.stringify(drafts.en) })
for (const lang of ['zh', 'en'] as const) {
  drafts[lang].metadata.series ??= { name: '', order: 1 }
  snapshots[lang] = JSON.stringify(drafts[lang])
}
const draft = computed(() => drafts[contentLocale.value]),
  dirty = computed(
    () => JSON.stringify(drafts.zh) !== snapshots.zh || JSON.stringify(drafts.en) !== snapshots.en,
  )
const tags = computed({
  get: () => draft.value.metadata.tags.join(', '),
  set: (value) =>
    (draft.value.metadata.tags = value
      .split(/[,，]/)
      .map((v) => v.trim())
      .filter(Boolean)),
})
const { data: blogTags } = await useAsyncData('editor-blog-tags', () =>
  request<BlogTags>('/api/blog-tags', { query: { locale: 'zh' } }),
)
function toggleTag(tag: string) {
  const values = draft.value.metadata.tags
  draft.value.metadata.tags = values.includes(tag)
    ? values.filter((value) => value !== tag)
    : [...values, tag]
}
const technologies = computed({
  get: () => draft.value.metadata.technologies.join(', '),
  set: (value) =>
    (draft.value.metadata.technologies = value
      .split(/[,，]/)
      .map((v) => v.trim())
      .filter(Boolean)),
})
function sync(value: AdminContent, lang: Locale) {
  record.value = value
  drafts[lang] = structuredClone(toRaw(value.translations[lang])!)
  snapshots[lang] = JSON.stringify(drafts[lang])
}
async function persist(publish = false) {
  if (busy.value) return
  busy.value = true
  const lang = contentLocale.value
  try {
    const body = { ...draft.value, expectedVersion: draft.value.version, kind: kind.value }
    let value = record.value
    if (!value) value = await apiWrite<AdminContent>('/api/admin/content', 'POST', body)
    else if (JSON.stringify(draft.value) !== snapshots[lang] || !draft.value.draftRevisionId)
      value = await apiWrite<AdminContent>(`/api/admin/content/${value.id}/draft`, 'PUT', body)
    sync(value, lang)
    if (publish) {
      value = await apiWrite<AdminContent>(`/api/admin/content/${value.id}/publish`, 'POST', {
        locale: lang,
        expectedVersion: draft.value.version,
      })
      sync(value, lang)
    }
    notify(t(publish ? 'admin.publishedSuccess' : 'admin.saved'))
    if (isNew) {
      snapshots.zh = JSON.stringify(drafts.zh)
      snapshots.en = JSON.stringify(drafts.en)
      await navigateTo(`/admin/edit/${value.id}`, { replace: true })
    }
  } catch (e) {
    fail(e)
  } finally {
    busy.value = false
  }
}
async function unpublish() {
  if (!record.value || busy.value) return
  busy.value = true
  try {
    const result = await apiWrite<AdminContent>(`/api/admin/content/${record.value.id}/unpublish`, 'POST', {
      locale: contentLocale.value,
      expectedVersion: draft.value.version,
    })
    const lang = contentLocale.value
    drafts[lang].version = result.translations[lang]!.version
    drafts[lang].publishedRevisionId = null
    drafts[lang].publishedAt = null
    record.value = result
    const previous = JSON.parse(snapshots[lang])
    previous.version = drafts[lang].version
    previous.publishedRevisionId = null
    previous.publishedAt = null
    snapshots[lang] = JSON.stringify(previous)
    notify(t('admin.unpublishedSuccess'))
  } catch (e) {
    fail(e)
  } finally {
    busy.value = false
  }
}
async function cover(event: Event) {
  const input = event.target as HTMLInputElement,
    file = input.files?.[0]
  if (!file) return
  try {
    const body = new FormData()
    body.append('file', file)
    const asset = await apiWrite<{ id: string }>('/api/admin/media', 'POST', body)
    draft.value.coverId = asset.id
  } catch (e) {
    fail(e)
  } finally {
    input.value = ''
  }
}
function suggestSlug() {
  if (!draft.value.slug)
    draft.value.slug = draft.value.title
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 160)
}
onBeforeRouteLeave(() => !dirty.value || confirm(t('admin.unsaved')))
const prevent = (event: BeforeUnloadEvent) => {
  if (dirty.value) {
    event.preventDefault()
    event.returnValue = ''
  }
}
onMounted(() => window.addEventListener('beforeunload', prevent))
onUnmounted(() => window.removeEventListener('beforeunload', prevent))
useSeoMeta({ title: () => t('admin.edit'), robots: 'noindex,nofollow' })
</script>
<template>
  <div class="editor-top">
    <NuxtLink to="/admin" class="back-link"
      ><AppIcon name="left" :size="15" />{{ t('admin.content') }}</NuxtLink
    >
    <div class="editor-buttons">
      <button v-if="draft.publishedRevisionId" class="button" :disabled="busy" @click="unpublish">
        {{ t('admin.unpublish') }}</button
      ><button class="button" :disabled="busy" @click="persist()">
        {{ t(busy ? 'loading' : 'admin.save') }}</button
      ><button class="button primary" :disabled="busy" @click="persist(true)">
        {{ t('admin.publish') }}<AppIcon name="arrow" :size="14" />
      </button>
    </div>
  </div>
  <div class="editor-top">
    <div v-if="kind === 'blog'" class="segmented" :aria-label="t('admin.language')">
      <button
        v-for="lang in ['zh', 'en'] as const"
        :key="lang"
        :class="{ selected: contentLocale === lang }"
        :disabled="busy || (isNew && lang !== contentLocale)"
        @click="contentLocale = lang"
      >
        {{ lang === 'zh' ? '中文' : 'English' }}
      </button>
    </div>
    <span class="editor-status"
      ><span class="status-dot" v-if="draft.publishedRevisionId" />{{
        t(draft.publishedRevisionId ? 'admin.published' : 'admin.draft')
      }}
      · v{{ draft.version }}<span v-if="dirty">*</span></span
    >
  </div>
  <p v-if="kind === 'blog'" class="editor-help">{{ t('admin.translationHint') }}</p>
  <div class="editor-meta">
    <div>
      <label class="field"
        ><span>{{ t('admin.titleLabel') }}</span
        ><input v-model="draft.title" class="title-input" maxlength="200" required @blur="suggestSlug"
      /></label>
      <div class="form-grid">
        <label class="field"
          ><span>{{ t('admin.slug') }}</span
          ><input v-model="draft.slug" maxlength="160" required /></label
        ><label class="field"
          ><span>{{ t('admin.kind') }}</span
          ><select v-model="kind" :disabled="!isNew">
            <option v-for="value in ['blog', 'project']" :key="value" :value="value">
              {{ t(`kind.${value}`) }}
            </option>
          </select></label
        >
      </div>
      <label class="field"
        ><span>{{ t('admin.summary') }}</span
        ><textarea v-model="draft.summary" maxlength="500" rows="2" />
      </label>
      <div class="form-grid">
        <label class="field"
          ><span>{{ t('admin.category') }}</span
          ><input v-model="draft.metadata.category" maxlength="60" /></label
        ><label class="field"
          ><span>{{ t('admin.tags') }}</span
          ><input v-model="tags"
        /></label>
      </div>
      <div v-if="kind === 'blog'" class="editor-tag-picker">
        <p>{{ t('admin.tagHint') }}</p>
        <div class="topic-links">
          <button
            v-for="tag in blogTags?.tags"
            :key="tag.name"
            type="button"
            :aria-pressed="draft.metadata.tags.includes(tag.name)"
            :class="{ selected: draft.metadata.tags.includes(tag.name) }"
            :disabled="!draft.metadata.tags.includes(tag.name) && draft.metadata.tags.length >= 12"
            @click="toggleTag(tag.name)"
          >
            <span aria-hidden="true">{{ draft.metadata.tags.includes(tag.name) ? '−' : '+' }}</span
            >{{ tag.name }}
          </button>
        </div>
      </div>
    </div>
    <aside class="editor-sidebar">
      <div class="field">
        <span>{{ t('admin.cover') }}</span
        ><label class="upload-box"
          ><img v-if="draft.coverId" :src="`/api/media/${draft.coverId}`" :alt="t('admin.cover')" /><span
            v-else
            ><AppIcon name="image" />{{ t('admin.upload') }}</span
          ><input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            :aria-label="t('admin.cover')"
            @change="cover" /></label
        ><button v-if="draft.coverId" class="small-button" @click="draft.coverId = null">
          {{ t('admin.removeCover') }}
        </button>
      </div>
      <div>
        <label v-if="kind === 'project' || kind === 'blog'" class="checkbox"
          ><input v-model="draft.metadata.featured" type="checkbox" />{{ t('admin.featured') }}</label
        ><label v-if="kind === 'project'" class="checkbox"
          ><input v-model="draft.metadata.flagship" type="checkbox" />{{ t('admin.flagship') }}</label
        >
        <template v-if="kind === 'life'"
          ><label class="field"
            ><span>{{ t('admin.occurredOn') }}</span
            ><input v-model="draft.metadata.occurredOn" type="date" /></label
          ><label class="field"
            ><span>{{ t('admin.location') }}</span
            ><input v-model="draft.metadata.location" maxlength="100" /></label
        ></template>
      </div>
    </aside>
  </div>
  <div v-if="kind === 'project'" class="form-grid">
    <label class="field"
      ><span>{{ t('admin.projectUrl') }}</span
      ><input v-model="draft.metadata.projectUrl" type="url" placeholder="https://" /></label
    ><label class="field"
      ><span>{{ t('admin.repositoryUrl') }}</span
      ><input v-model="draft.metadata.repositoryUrl" type="url" placeholder="https://" /></label
    ><label class="field"
      ><span>{{ t('admin.projectStatus') }}</span
      ><input v-model="draft.metadata.projectStatus" maxlength="60" /></label
    ><label class="field"
      ><span>{{ t('admin.technologies') }}</span
      ><input v-model="technologies"
    /></label>
  </div>
  <div v-if="kind === 'blog' && draft.metadata.series" class="series-editor">
    <div class="form-grid">
      <label class="field"
        ><span>{{ t('admin.seriesName') }}</span
        ><input v-model="draft.metadata.series.name" maxlength="100" /></label
      ><label class="field"
        ><span>{{ t('admin.seriesOrder') }}</span
        ><input v-model.number="draft.metadata.series.order" type="number" min="1" max="10000"
      /></label>
    </div>
    <p class="editor-help">{{ t('admin.seriesHint') }}</p>
  </div>
  <MarkdownEditor v-model="draft.markdown" :key="contentLocale" @save="persist()" />
  <p class="editor-help">{{ t('admin.mediaHelp') }}</p>
  <ProjectSectionsEditor v-if="kind === 'project'" v-model="draft.metadata" />
</template>
