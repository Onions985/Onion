<script setup lang="ts">
import type { AdminContent, MediaAsset } from '../../../../shared/types'
import { metadataSchema } from '#shared/validation'

definePageMeta({ layout: 'admin', middleware: 'admin', key: (route) => String(route.params.id) })
const route = useRoute(),
  request = useRequestFetch()
const { site, t } = useSite(),
  { notify, fail } = useFeedback()
const isNew = route.params.id === 'new'
const { data: initial } = await useAsyncData(`moment-edit:${route.params.id}`, () =>
  isNew ? Promise.resolve(null) : request<AdminContent>(`/api/admin/content/${route.params.id}`),
)
if (!isNew && (!initial.value || initial.value.kind !== 'life'))
  throw createError({ statusCode: 404, statusMessage: 'Content not found' })
const record = ref(initial.value)
const source = computed(() => record.value?.translations.zh)
function modelFrom(value: AdminContent | null | undefined) {
  const draft = value?.translations.zh
  const moment = draft?.metadata.moment || draft?.legacyMoment
  return {
    text: moment?.text || '',
    imageIds: [...(moment?.imageIds || [])],
    occurredOn: draft?.metadata.occurredOn || '',
    location: draft?.metadata.location || '',
  }
}
const model = ref(modelFrom(record.value))
const snapshot = ref(JSON.stringify(model.value))
const busy = ref(false),
  uploading = ref(false),
  uploadProgress = ref('')
const locked = computed(() => busy.value || uploading.value)
const dirty = computed(() => JSON.stringify(model.value) !== snapshot.value)
const canPublish = computed(() => Boolean(model.value.text.trim() || model.value.imageIds.length))
const picker = ref<HTMLInputElement>()
function sync(value: AdminContent) {
  record.value = value
  model.value = modelFrom(value)
  snapshot.value = JSON.stringify(model.value)
}
async function persist(publish = false) {
  if (locked.value || (publish && !canPublish.value)) return
  busy.value = true
  try {
    const body = {
      locale: 'zh',
      kind: 'life',
      expectedVersion: source.value?.version || 0,
      slug: source.value?.slug || `moment-${crypto.randomUUID()}`,
      title: '手记',
      summary: '',
      markdown: '',
      coverId: null,
      metadata: {
        ...metadataSchema.parse(source.value?.metadata || {}),
        occurredOn: model.value.occurredOn,
        location: model.value.location,
        moment: { text: model.value.text, imageIds: [...model.value.imageIds] },
      },
    }
    let value = record.value
    if (!value) value = await apiWrite<AdminContent>('/api/admin/content', 'POST', body)
    else if (dirty.value || !source.value?.metadata.moment)
      value = await apiWrite<AdminContent>(`/api/admin/content/${value.id}/draft`, 'PUT', body)
    sync(value)
    if (publish) {
      value = await apiWrite<AdminContent>(`/api/admin/content/${value.id}/publish`, 'POST', {
        locale: 'zh',
        expectedVersion: source.value!.version,
      })
      sync(value)
    }
    notify(t(publish ? 'admin.publishedSuccess' : 'admin.saved'))
    if (isNew) await navigateTo(`/admin/moments/${value.id}`, { replace: true })
  } catch (error) {
    fail(error)
  } finally {
    busy.value = false
  }
}
async function unpublish() {
  if (!record.value || locked.value) return
  busy.value = true
  try {
    const value = await apiWrite<AdminContent>(`/api/admin/content/${record.value.id}/unpublish`, 'POST', {
      locale: 'zh',
      expectedVersion: source.value!.version,
    })
    // Keep unsaved text and the chosen photo order when withdrawing a published moment.
    record.value = value
    notify(t('admin.unpublishedSuccess'))
  } catch (error) {
    fail(error)
  } finally {
    busy.value = false
  }
}
async function upload(event: Event) {
  const input = event.target as HTMLInputElement,
    files = Array.from(input.files || [])
  input.value = ''
  if (!files.length || locked.value) return
  if (model.value.imageIds.length + files.length > 9) return notify(t('error.MOMENT_IMAGE_LIMIT'), true)
  if (files.some((file) => file.size > 8 * 1024 * 1024)) return notify(t('error.MEDIA_TOO_LARGE'), true)
  if (files.some((file) => !['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type)))
    return notify(t('error.MEDIA_TYPE'), true)
  uploading.value = true
  let failed = 0
  try {
    for (const [index, file] of files.entries()) {
      uploadProgress.value = `${index + 1} / ${files.length}`
      try {
        const body = new FormData()
        body.append('file', file)
        const asset = await apiWrite<MediaAsset>('/api/admin/media', 'POST', body)
        model.value.imageIds.push(asset.id)
      } catch {
        failed++
      }
    }
    if (failed) notify(`${t('moment.uploadFailed')} (${failed})`, true)
  } finally {
    uploading.value = false
    uploadProgress.value = ''
  }
}
function move(index: number, target: number) {
  if (locked.value || target < 0 || target >= model.value.imageIds.length) return
  const [id] = model.value.imageIds.splice(index, 1)
  model.value.imageIds.splice(target, 0, id!)
}
onBeforeRouteLeave(() => (!dirty.value && !uploading.value) || confirm(t('admin.unsaved')))
const prevent = (event: BeforeUnloadEvent) => {
  if (dirty.value || uploading.value) {
    event.preventDefault()
    event.returnValue = ''
  }
}
onMounted(() => window.addEventListener('beforeunload', prevent))
onUnmounted(() => window.removeEventListener('beforeunload', prevent))
useSeoMeta({ title: () => t(isNew ? 'moment.compose' : 'moment.edit'), robots: 'noindex,nofollow' })
</script>
<template>
  <div class="moment-editor">
    <NuxtLink to="/admin" class="back-link"
      ><AppIcon name="left" :size="15" />{{ t('admin.content') }}</NuxtLink
    >
    <header class="moment-editor-heading">
      <div>
        <p class="eyebrow">MOMENTS</p>
        <h1>{{ t(isNew ? 'moment.compose' : 'moment.edit') }}</h1>
      </div>
      <span class="status-badge" :class="{ published: source?.publishedRevisionId }"
        >{{ t(source?.publishedRevisionId ? 'admin.published' : 'admin.draft')
        }}<span v-if="source?.publishedRevisionId && source.draftRevisionId !== source.publishedRevisionId">
          · {{ t('admin.unpublishedChanges') }}</span
        ><span v-if="dirty"> *</span></span
      >
    </header>
    <p v-if="source?.legacyMoment && !source.metadata.moment" class="editor-help">
      {{ t('moment.legacyHint') }}
    </p>
    <form class="moment-composer" @submit.prevent="persist(true)">
      <div class="moment-composer-author">
        <SiteAvatar :size="42" /><strong>{{ site?.profile.displayName }}</strong
        ><span>{{ t('moment.onlyAuthor') }}</span>
      </div>
      <label class="moment-text-field"
        ><span class="sr-only">{{ t('moment.text') }}</span
        ><textarea
          v-model="model.text"
          :disabled="locked"
          :placeholder="t('moment.prompt')"
          maxlength="10000"
          rows="7"
        />
      </label>
      <div class="moment-compose-caption">
        <span>{{ t('moment.photoHint') }}</span
        ><span>{{ model.text.length }} / 10000</span>
      </div>
      <div class="moment-photo-picker" :aria-label="t('moment.photos')" :aria-busy="uploading">
        <div v-for="(id, index) in model.imageIds" :key="id" class="moment-photo-tile">
          <img :src="`/api/media/${id}`" :alt="`${t('moment.image')} ${index + 1}`" />
          <span v-if="index === 0" class="moment-cover-badge">{{ t('moment.cover') }}</span>
          <button
            class="moment-photo-remove"
            type="button"
            :disabled="locked"
            :aria-label="`${t('moment.remove')} ${index + 1}`"
            @click="model.imageIds.splice(index, 1)"
          >
            <AppIcon name="close" :size="15" />
          </button>
          <div class="moment-photo-controls">
            <button
              type="button"
              :disabled="locked || index === 0"
              :aria-label="t('moment.moveEarlier')"
              @click="move(index, index - 1)"
            >
              <AppIcon name="left" :size="14" />
            </button>
            <button v-if="index > 0" type="button" :disabled="locked" @click="move(index, 0)">
              {{ t('moment.makeCover') }}
            </button>
            <span v-else>{{ index + 1 }} / {{ model.imageIds.length }}</span>
            <button
              type="button"
              :disabled="locked || index === model.imageIds.length - 1"
              :aria-label="t('moment.moveLater')"
              @click="move(index, index + 1)"
            >
              <AppIcon name="right" :size="14" />
            </button>
          </div>
        </div>
        <button
          v-if="model.imageIds.length < 9"
          type="button"
          class="moment-add-photos"
          :disabled="locked"
          @click="picker?.click()"
        >
          <AppIcon name="plus" :size="25" /><span>{{
            t(uploading ? 'moment.uploading' : 'moment.photos')
          }}</span
          ><small>{{ uploading ? uploadProgress : `${model.imageIds.length} / 9` }}</small>
        </button>
      </div>
      <input
        ref="picker"
        type="file"
        hidden
        multiple
        accept="image/png,image/jpeg,image/webp,image/gif"
        :disabled="locked"
        :aria-label="t('moment.photos')"
        @change="upload"
      />
      <p v-if="uploading" class="editor-help" role="status">
        {{ t('moment.uploading') }} {{ uploadProgress }}
      </p>
      <details class="moment-extra">
        <summary>{{ t('moment.extra') }}</summary>
        <div class="form-grid">
          <label class="field"
            ><span>{{ t('admin.location') }}</span
            ><input v-model="model.location" :disabled="locked" maxlength="100" /></label
          ><label class="field"
            ><span>{{ t('admin.occurredOn') }}</span
            ><input v-model="model.occurredOn" :disabled="locked" type="date"
          /></label>
        </div>
      </details>
      <div class="moment-compose-actions">
        <button
          v-if="source?.publishedRevisionId"
          type="button"
          class="text-link"
          :disabled="locked"
          @click="unpublish"
        >
          {{ t('admin.unpublish') }}
        </button>
        <div>
          <button type="button" class="button" :disabled="locked" @click="persist()">
            {{ t('admin.save') }}</button
          ><button type="submit" class="button primary" :disabled="locked || !canPublish">
            {{ t(busy ? 'loading' : 'moment.publish') }}<AppIcon name="arrow" :size="15" />
          </button>
        </div>
      </div>
    </form>
  </div>
</template>
