<script setup lang="ts">
import type { ContentDetail } from '../../shared/types'
const props = defineProps<{ item: ContentDetail }>()
const { t } = useSite()
const route = useRoute(),
  router = useRouter()
const sectionIds = ['overview', 'modules', 'screenshots'] as const
type SectionId = (typeof sectionIds)[number]
const activeSection = ref<SectionId>('overview')
const tabs = computed(() => [
  { id: 'overview' as const, label: t('project.overview'), icon: 'book', count: null },
  {
    id: 'modules' as const,
    label: t('project.modules'),
    icon: 'code',
    count: props.item.metadata.projectModules?.length || 0,
  },
  {
    id: 'screenshots' as const,
    label: t('project.screenshots'),
    icon: 'image',
    count: props.item.metadata.projectScreenshots?.length || 0,
  },
])
function syncSection() {
  activeSection.value = sectionIds.find((id) => route.hash === `#project-${id}`) || 'overview'
}
onMounted(syncSection)
watch(() => route.hash, syncSection)
async function selectSection(id: SectionId) {
  activeSection.value = id
  await router.replace({ hash: `#project-${id}` })
}
async function onTabKeydown(event: KeyboardEvent, index: number) {
  let next = index
  if (event.key === 'ArrowRight') next = (index + 1) % tabs.value.length
  else if (event.key === 'ArrowLeft') next = (index + tabs.value.length - 1) % tabs.value.length
  else if (event.key === 'Home') next = 0
  else if (event.key === 'End') next = tabs.value.length - 1
  else return
  event.preventDefault()
  const list = (event.currentTarget as HTMLElement).parentElement
  await selectSection(tabs.value[next]!.id)
  await nextTick()
  list?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus({ preventScroll: true })
}
const selected = ref<{ mediaId: string; caption: string } | null>(null)
const viewer = ref<HTMLDialogElement | null>(null)
function open(image: { mediaId: string; caption: string }) {
  selected.value = image
  viewer.value?.showModal()
}
</script>
<template>
  <div class="project-presentation">
    <div class="project-section-toolbar">
      <div class="project-section-nav" role="tablist" :aria-label="t('project.contents')">
        <button
          v-for="(tab, index) in tabs"
          :id="`project-tab-${tab.id}`"
          :key="tab.id"
          type="button"
          role="tab"
          :aria-selected="activeSection === tab.id"
          :aria-controls="`project-${tab.id}`"
          :tabindex="activeSection === tab.id ? 0 : -1"
          @click="selectSection(tab.id)"
          @keydown="onTabKeydown($event, index)"
        >
          <AppIcon :name="tab.icon" :size="20" />
          <span class="project-tab-label">{{ tab.label }}</span>
          <span v-if="tab.count !== null" class="project-tab-count">{{ tab.count }}</span>
        </button>
      </div>
      <div
        v-if="item.metadata.projectUrl || item.metadata.repositoryUrl || item.metadata.projectStory?.demoUrl"
        class="project-resource-panel"
      >
        <a
          v-if="item.metadata.projectStory?.demoUrl"
          :href="item.metadata.projectStory.demoUrl"
          class="button"
          target="_blank"
          rel="noopener noreferrer"
          >{{ t('project.demo') }}<AppIcon name="arrow" :size="16"
        /></a>
        <a
          v-if="item.metadata.projectUrl"
          :href="item.metadata.projectUrl"
          class="button primary"
          target="_blank"
          rel="noopener noreferrer"
        >
          {{ t('project.visit') }}<AppIcon name="arrow" :size="16" />
        </a>
        <a
          v-if="item.metadata.repositoryUrl"
          :href="item.metadata.repositoryUrl"
          class="button"
          target="_blank"
          rel="noopener noreferrer"
        >
          {{ t('project.source') }}<AppIcon name="code" :size="16" />
        </a>
      </div>
    </div>
    <section
      id="project-overview"
      v-show="activeSection === 'overview'"
      class="project-section"
      role="tabpanel"
      aria-labelledby="project-tab-overview"
      tabindex="0"
    >
      <div class="project-section-heading">
        <span>01</span>
        <h2>{{ t('project.overview') }}</h2>
      </div>
      <div class="prose" v-html="item.html" />
      <div
        v-if="item.metadata.projectStory?.decision || item.metadata.projectStory?.outcome"
        class="project-story"
      >
        <section v-if="item.metadata.projectStory.decision">
          <h3>{{ t('project.decision') }}</h3>
          <p>{{ item.metadata.projectStory.decision }}</p>
        </section>
        <section v-if="item.metadata.projectStory.outcome">
          <h3>{{ t('project.outcome') }}</h3>
          <p>{{ item.metadata.projectStory.outcome }}</p>
        </section>
      </div>
    </section>
    <section
      id="project-modules"
      v-show="activeSection === 'modules'"
      class="project-section"
      role="tabpanel"
      aria-labelledby="project-tab-modules"
      tabindex="0"
    >
      <div class="project-section-heading">
        <span>02</span>
        <h2>{{ t('project.modules') }}</h2>
      </div>
      <div v-if="item.metadata.projectModules?.length" class="project-module-grid">
        <article
          v-for="(module, index) in item.metadata.projectModules"
          :key="index"
          class="project-module-card"
        >
          <span class="module-number">{{ String(index + 1).padStart(2, '0') }}</span>
          <h3>{{ module.title }}</h3>
          <p>{{ module.description }}</p>
          <ul v-if="module.features.length">
            <li v-for="(feature, featureIndex) in module.features" :key="featureIndex">{{ feature }}</li>
          </ul>
        </article>
      </div>
      <p v-else class="project-section-empty">{{ t('project.noModules') }}</p>
    </section>
    <section
      id="project-screenshots"
      v-show="activeSection === 'screenshots'"
      class="project-section"
      role="tabpanel"
      aria-labelledby="project-tab-screenshots"
      tabindex="0"
    >
      <div class="project-section-heading">
        <span>03</span>
        <h2>{{ t('project.screenshots') }}</h2>
      </div>
      <div v-if="item.metadata.projectScreenshots?.length" class="project-screenshot-grid">
        <figure v-for="image in item.metadata.projectScreenshots" :key="image.mediaId">
          <button
            type="button"
            :aria-label="`${t('project.viewScreenshot')} ${image.caption}`"
            @click="open(image)"
          >
            <img :src="`/api/media/${image.mediaId}`" :alt="image.caption || item.title" loading="lazy" />
          </button>
          <figcaption v-if="image.caption">{{ image.caption }}</figcaption>
        </figure>
      </div>
      <div v-else class="project-screenshots-empty">
        <AppIcon name="image" :size="28" />
        <p>{{ t('project.noScreenshots') }}</p>
      </div>
    </section>
    <dialog
      ref="viewer"
      class="project-image-dialog"
      @click="$event.target === viewer && viewer?.close()"
      @close="selected = null"
    >
      <button class="button" :aria-label="t('close')" @click="viewer?.close()">
        <AppIcon name="close" />
      </button>
      <figure v-if="selected">
        <img :src="`/api/media/${selected.mediaId}`" :alt="selected.caption || item.title" />
        <figcaption>{{ selected.caption }}</figcaption>
      </figure>
    </dialog>
  </div>
</template>
