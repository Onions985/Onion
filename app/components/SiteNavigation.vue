<script setup lang="ts">
import type { ContentKind, NavigationPreview } from '../../shared/types'
const { site, t, locale, contentUrl, tagUrl } = useSite()
const route = useRoute()
const nav = ref<HTMLElement>()
const panel = ref<HTMLElement>()
const panelId = useId()
const previewPath = ref('')
const opened = ref(false)
const keyboard = ref(false)
const placement = ref<Record<string, string>>({})
let openTimer: ReturnType<typeof setTimeout> | undefined
let closeTimer: ReturnType<typeof setTimeout> | undefined
let invoker: HTMLElement | null = null
const icons: Record<string, string> = { '': 'home', writing: 'book', projects: 'code', life: 'leaf', about: 'user' }
const kinds: Record<string, ContentKind> = { writing: 'blog', projects: 'project', life: 'life' }
const paths: Record<ContentKind, string> = { blog: 'writing', project: 'projects', life: 'life' }
const contentKinds: ContentKind[] = ['blog', 'project', 'life']
const url = (path: string) => `/${locale.value}${path ? '/' + path : ''}`
const active = (path: string) => path
  ? route.path.split('/')[2] === path || (path === 'writing' && ['posts', 'tags'].includes(route.path.split('/')[2] || ''))
  : route.path === url('')
const { data, error } = await useAsyncData(
  () => `navigation:${locale.value}`,
  () => $fetch<NavigationPreview>('/api/navigation', { query: { locale: locale.value } }),
)
const item = computed(() => site.value?.config.navigation.find(item => item.path === previewPath.value))
const kind = computed(() => kinds[previewPath.value])
const section = computed(() => kind.value ? data.value?.sections[kind.value] : undefined)
const subtitle = computed(() => previewPath.value === '' ? site.value?.profile.description :
  previewPath.value === 'about' ? site.value?.profile.headline : t(`${previewPath.value}.subtitle`))
function clearTimers() { clearTimeout(openTimer); clearTimeout(closeTimer) }
function position(path: string, target: HTMLElement) {
  const bounds = nav.value!.getBoundingClientRect()
  const width = Math.min(760, window.innerWidth - 32)
  const left = Math.max(16, Math.min(bounds.left - 100, window.innerWidth - width - 16))
  const top = bounds.bottom + 10
  const anchor = target.getBoundingClientRect()
  placement.value = { width: `${width}px`, left: `${left}px`, top: `${top}px`,
    maxHeight: `calc(100dvh - ${top + 16}px)`,
    transformOrigin: `${Math.max(16, Math.min(width - 16, anchor.left + anchor.width / 2 - left))}px top` }
  previewPath.value = path
  invoker = target
}
function prepare(path: string, event: MouseEvent) {
  clearTimers()
  keyboard.value = event.detail === 0
  position(path, event.currentTarget as HTMLElement)
}
function hover(path: string, event: PointerEvent) {
  if (event.pointerType !== 'mouse' || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return
  clearTimers()
  const target = event.currentTarget as HTMLElement
  openTimer = setTimeout(() => {
    keyboard.value = false
    position(path, target.querySelector('button') || target)
    panel.value?.showPopover()
  }, opened.value ? 0 : 120)
}
function close(restoreFocus = false) {
  clearTimers()
  if (panel.value?.matches(':popover-open')) panel.value.hidePopover()
  opened.value = false
  if (restoreFocus) invoker?.focus()
}
function leave() {
  clearTimers()
  closeTimer = setTimeout(() => { if (!panel.value?.contains(document.activeElement)) close() }, 160)
}
function focusLeave(event: FocusEvent) {
  const next = event.relatedTarget as Node | null
  if (!panel.value?.contains(next) && !nav.value?.contains(next)) close()
}
async function enter(path: string, event: KeyboardEvent) {
  clearTimers()
  keyboard.value = true
  position(path, event.currentTarget as HTMLElement)
  panel.value?.showPopover()
  await nextTick()
  panel.value?.querySelector<HTMLElement>('.preview-main a')?.focus()
}
function toggled(event: Event) {
  opened.value = (event as ToggleEvent).newState === 'open'
  if (!opened.value) clearTimers()
}
const dismiss = () => close()
watch(() => route.fullPath, dismiss)
onMounted(() => {
  window.addEventListener('scroll', dismiss, { passive: true })
  window.addEventListener('resize', dismiss)
})
onBeforeUnmount(() => {
  clearTimers()
  window.removeEventListener('scroll', dismiss)
  window.removeEventListener('resize', dismiss)
})
</script>
<template>
  <nav ref="nav" class="main-nav" :aria-label="t('nav.label')" @focusout="focusLeave" @keydown.esc.stop.prevent="close(true)">
    <div v-for="entry in site?.config.navigation" :key="entry.path" class="nav-item"
      :class="{ 'preview-active': opened && previewPath === entry.path }" :data-section="entry.path || 'home'"
      @pointerenter="hover(entry.path, $event)" @pointerleave="leave">
      <NuxtLink :to="url(entry.path)" :class="{ active: active(entry.path) }" :aria-current="active(entry.path) ? 'page' : undefined"
        @click="close()" @keydown.down.prevent="enter(entry.path, $event)">
        <AppIcon :name="icons[entry.path] || 'book'" :size="17" class="nav-icon" /><span>{{ t(entry.label) }}</span>
      </NuxtLink>
      <button type="button" class="nav-preview-toggle" :aria-label="`${t('nav.preview')}${locale === 'en' ? ' ' : ''}${t(entry.label)}`"
        :aria-expanded="opened && previewPath === entry.path" :aria-controls="panelId" :popovertarget="panelId"
        :popovertargetaction="opened && previewPath === entry.path ? 'hide' : 'show'"
        @click="prepare(entry.path, $event)" @keydown.down.prevent="enter(entry.path, $event)">
        <AppIcon name="chevron" :size="12" />
      </button>
    </div>
  </nav>
  <section :id="panelId" ref="panel" popover="auto" class="nav-preview" :class="{ 'keyboard-preview': keyboard }"
    :style="placement" :aria-label="`${t('nav.preview')} · ${t(item?.label || 'nav.home')}`" @beforetoggle="toggled"
    @pointerenter="clearTimers" @pointerleave="leave" @focusout="focusLeave" @keydown.esc.stop.prevent="close(true)">
    <aside class="preview-profile">
      <NuxtLink :to="url('about')" class="preview-identity" @click="close()">
        <img v-if="site?.config.avatarId" :src="`/api/media/${site.config.avatarId}`" alt="" width="48" height="48" />
        <OnionLogo v-else :size="48" /><strong>{{ site?.profile.displayName }}</strong>
      </NuxtLink>
      <p class="preview-motto">{{ site?.profile.motto }}</p>
      <div class="preview-stats">
        <NuxtLink v-for="type in contentKinds" :key="type" :to="url(paths[type])" @click="close()">
          <strong>{{ data?.sections[type].total ?? '—' }}</strong><span>{{ t(`kind.${type}`) }}</span>
        </NuxtLink>
      </div>
      <NuxtLink :to="url('about')" class="preview-about-link" @click="close()">{{ t('home.about') }}<AppIcon name="arrow" :size="14" /></NuxtLink>
    </aside>
    <div class="preview-main">
      <header class="preview-heading">
        <div><small>{{ t(kind ? 'nav.latest' : 'nav.explore') }}</small><h2>{{ t(item?.label || 'nav.home') }}</h2></div>
        <button type="button" class="icon-button" :aria-label="t('nav.close')" @click="close(true)"><AppIcon name="close" :size="16" /></button>
      </header>
      <p class="preview-subtitle">{{ subtitle }}</p>
      <p v-if="error" class="field-error">{{ t('error.generic') }}</p>
      <template v-else-if="kind">
        <div v-if="section?.items.length" class="preview-entries">
          <NuxtLink v-for="entry in section.items" :key="entry.id" :to="contentUrl(entry)" class="preview-entry" @click="close()">
            <img v-if="entry.coverId" :src="`/api/media/${entry.coverId}`" alt="" width="48" height="48" />
            <span v-else class="preview-entry-icon"><AppIcon :name="icons[previewPath] || 'book'" :size="21" /></span>
            <span class="preview-entry-copy"><strong>{{ entry.title }}</strong><span>{{ entry.summary }}</span></span><AppIcon name="arrow" :size="14" />
          </NuxtLink>
        </div>
        <div v-else class="preview-empty"><AppIcon :name="icons[previewPath] || 'book'" :size="27" /><p>{{ t(`nav.${kind}Empty`) }}</p></div>
        <div v-if="kind === 'blog' && data?.tags.length" class="preview-topics">
          <NuxtLink v-for="tag in data.tags" :key="tag.name" :to="tagUrl(tag.name)" @click="close()"># {{ tag.name }}</NuxtLink>
        </div>
        <NuxtLink :to="url(previewPath)" class="preview-view-all" @click="close()">{{ t('all') }}<AppIcon name="right" :size="15" /></NuxtLink>
      </template>
      <template v-else-if="previewPath === 'about'">
        <p class="preview-bio">{{ site?.profile.description }}</p><blockquote>{{ site?.profile.quote }}</blockquote>
        <NuxtLink :to="url('about')" class="preview-view-all" @click="close()">{{ t('home.about') }}<AppIcon name="right" :size="15" /></NuxtLink>
      </template>
      <div v-else class="preview-destinations">
        <NuxtLink v-for="type in contentKinds" :key="type" :to="url(paths[type])" @click="close()">
          <AppIcon :name="icons[paths[type]] || 'book'" :size="20" /><strong>{{ t(`nav.${paths[type]}`) }}</strong>
          <span>{{ t(`${paths[type]}.subtitle`) }}</span><AppIcon name="arrow" :size="14" />
        </NuxtLink>
      </div>
    </div>
  </section>
</template>
