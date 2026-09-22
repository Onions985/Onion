<script setup lang="ts">
import type { ContentMetadata } from '../../shared/types'
const metadata = defineModel<ContentMetadata>({ required: true })
const { t } = useSite(),
  { fail } = useFeedback()
const uploading = ref(false)
function addModule() {
  ;(metadata.value.projectModules ||= []).push({ title: '', description: '', features: [] })
}
function updateFeatures(index: number, event: Event) {
  metadata.value.projectModules![index]!.features = (event.target as HTMLTextAreaElement).value
    .split('\n')
    .map((value) => value.trim())
    .filter(Boolean)
}
async function upload(event: Event) {
  const input = event.target as HTMLInputElement
  const files = [...(input.files || [])]
  uploading.value = true
  try {
    for (const file of files.slice(0, 20 - (metadata.value.projectScreenshots?.length || 0))) {
      const body = new FormData()
      body.append('file', file)
      const asset = await apiWrite<{ id: string }>('/api/admin/media', 'POST', body)
      ;(metadata.value.projectScreenshots ||= []).push({ mediaId: asset.id, caption: '' })
    }
  } catch (error) {
    fail(error)
  } finally {
    uploading.value = false
    input.value = ''
  }
}
</script>
<template>
  <section class="project-sections-editor">
    <h2>{{ t('project.modules') }}</h2>
    <p class="editor-help">{{ t('admin.modulesHint') }}</p>
    <div v-for="(module, index) in metadata.projectModules || []" :key="index" class="project-module-editor">
      <label class="field"
        ><span>{{ t('admin.moduleTitle') }}</span
        ><input v-model="module.title" maxlength="100"
      /></label>
      <label class="field"
        ><span>{{ t('admin.moduleDescription') }}</span
        ><textarea v-model="module.description" rows="3" maxlength="1000" />
      </label>
      <label class="field"
        ><span>{{ t('admin.moduleFeatures') }}</span
        ><textarea :value="module.features.join('\n')" rows="5" @change="updateFeatures(index, $event)" />
      </label>
      <button class="small-button" type="button" @click="metadata.projectModules?.splice(index, 1)">
        {{ t('admin.removeModule') }}
      </button>
    </div>
    <button
      class="button"
      type="button"
      :disabled="(metadata.projectModules?.length || 0) >= 24"
      @click="addModule"
    >
      <AppIcon name="plus" :size="16" />{{ t('admin.addModule') }}
    </button>
    <h2>{{ t('project.screenshots') }}</h2>
    <p class="editor-help">{{ t('admin.screenshotsHint') }}</p>
    <div class="project-screenshot-editor-grid">
      <div
        v-for="(image, index) in metadata.projectScreenshots || []"
        :key="image.mediaId"
        class="project-screenshot-editor"
      >
        <img :src="`/api/media/${image.mediaId}`" :alt="image.caption" />
        <label class="field"
          ><span>{{ t('admin.screenshotCaption') }}</span
          ><input v-model="image.caption" maxlength="200"
        /></label>
        <button class="small-button" type="button" @click="metadata.projectScreenshots?.splice(index, 1)">
          {{ t('admin.removeScreenshot') }}
        </button>
      </div>
    </div>
    <input
      type="file"
      multiple
      accept="image/png,image/jpeg,image/webp,image/gif"
      :aria-label="t('admin.uploadScreenshots')"
      :disabled="uploading || (metadata.projectScreenshots?.length || 0) >= 20"
      @change="upload"
    />
    <p v-if="uploading" role="status">{{ t('admin.screenshotUploading') }}</p>
  </section>
</template>
