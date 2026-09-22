<script setup lang="ts">
const props = withDefaults(defineProps<{ images: string[]; detail?: boolean }>(), { detail: false })
const { t } = useSite()
const viewer = ref<HTMLDialogElement>(),
  active = ref(0)
function open(index: number) {
  active.value = index
  viewer.value?.showModal()
}
function step(direction: number) {
  active.value = (active.value + direction + props.images.length) % props.images.length
}
watch(
  () => props.images,
  () => viewer.value?.close(),
)
</script>
<template>
  <div
    v-if="images.length"
    class="moment-gallery"
    :class="{ 'gallery-single': images.length === 1, 'gallery-detail': detail }"
    :data-count="images.length"
  >
    <button
      v-for="(id, index) in images"
      :key="id"
      type="button"
      :aria-label="`${t('moment.image')} ${index + 1} / ${images.length}`"
      @click="open(index)"
    >
      <img
        :src="`/api/media/${id}`"
        :alt="`${t('moment.image')} ${index + 1}`"
        loading="lazy"
        decoding="async"
      />
      <span v-if="index === 0" class="moment-photo-badge" aria-hidden="true">
        <AppIcon :name="images.length > 1 ? 'image' : 'expand'" :size="14" />
        <span v-if="images.length > 1">{{ images.length }}</span>
      </span>
    </button>
  </div>
  <dialog
    ref="viewer"
    class="moment-viewer"
    :aria-label="t('moment.image')"
    @click="
      (event) => {
        if (event.target === viewer) viewer?.close()
      }
    "
    @keydown.left.prevent="step(-1)"
    @keydown.right.prevent="step(1)"
  >
    <div class="moment-viewer-toolbar">
      <span aria-live="polite">{{ active + 1 }} / {{ images.length }}</span
      ><button type="button" :aria-label="t('moment.close')" @click="viewer?.close()">
        <AppIcon name="close" :size="24" />
      </button>
    </div>
    <div class="moment-viewer-image">
      <img
        v-if="images[active]"
        :src="`/api/media/${images[active]}`"
        :alt="`${t('moment.image')} ${active + 1}`"
      />
    </div>
    <div v-if="images.length > 1" class="moment-viewer-navigation">
      <button type="button" :aria-label="t('moment.previousImage')" @click="step(-1)">
        <AppIcon name="left" /></button
      ><button type="button" :aria-label="t('moment.nextImage')" @click="step(1)">
        <AppIcon name="right" />
      </button>
    </div>
  </dialog>
</template>
