<script setup lang="ts">
const { site, locale, t } = useSite()
const panelId = useId()
const opened = ref(false)
const updates = computed(() => {
  const now = site.value?.config.now
  return (now?.[locale.value]?.trim() || now?.zh?.trim() || '').split(/\n+/).filter(Boolean)
})
function toggled(event: Event) {
  opened.value = (event as ToggleEvent).newState === 'open'
}
</script>
<template>
  <template v-if="updates.length">
    <button
      type="button"
      class="home-now-trigger"
      :popovertarget="panelId"
      :aria-controls="panelId"
      :aria-expanded="opened"
    >
      <span class="status-dot" aria-hidden="true" />
      <span>{{ t('now.title') }}</span>
      <AppIcon name="chevron" :size="14" :class="{ 'points-up': !opened }" />
    </button>
    <section
      :id="panelId"
      popover="auto"
      class="home-now-panel"
      :aria-labelledby="`${panelId}-title`"
      @beforetoggle="toggled"
    >
      <header>
        <h2 :id="`${panelId}-title`">{{ t('now.title') }}</h2>
        <button
          type="button"
          class="icon-button"
          :aria-label="t('nav.close')"
          :popovertarget="panelId"
          popovertargetaction="hide"
          autofocus
        >
          <AppIcon name="close" :size="17" />
        </button>
      </header>
      <ul>
        <li v-for="(line, index) in updates" :key="index">{{ line }}</li>
      </ul>
      <time v-if="site?.config.now?.updatedOn" :datetime="site.config.now.updatedOn">
        {{ t('now.updated') }} {{ site.config.now.updatedOn }}
      </time>
    </section>
  </template>
</template>
<style scoped>
.home-now-trigger,
.home-now-panel {
  --now-edge: 24px;
  position: fixed;
  right: max(var(--now-edge), env(safe-area-inset-right, 0px));
  color: var(--fg);
  background: var(--surface);
  border: 1px solid var(--line);
  box-shadow: 0 6px 24px #00000012;
}
.home-now-trigger {
  bottom: calc(var(--now-edge) + env(safe-area-inset-bottom, 0px));
  z-index: 20;
  display: inline-flex;
  align-items: center;
  gap: 9px;
  min-height: 44px;
  padding: 0 15px;
  border-radius: 99px;
  font: 13px var(--font-sans);
}
.home-now-trigger:hover,
.home-now-trigger[aria-expanded='true'] {
  border-color: var(--accent);
}
.home-now-trigger .status-dot {
  margin: 0;
  flex-shrink: 0;
}
.points-up {
  transform: rotate(180deg);
}
.home-now-panel {
  inset-block-start: auto;
  inset-inline-start: auto;
  bottom: calc(var(--now-edge) + 56px + env(safe-area-inset-bottom, 0px));
  width: min(380px, calc(100% - 2 * var(--now-edge)));
  max-height: min(60vh, calc(100dvh - 160px));
  margin: 0;
  padding: 20px;
  border-radius: 16px;
  box-shadow: 0 12px 48px #00000024;
  overflow-y: auto;
  overscroll-behavior: contain;
}
.home-now-panel header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}
.home-now-panel h2 {
  font-size: 16px;
  font-weight: 600;
}
.home-now-panel .icon-button {
  width: 36px;
  height: 36px;
  flex-shrink: 0;
}
.home-now-panel ul {
  display: grid;
  gap: 14px;
  padding-left: 18px;
  list-style: disc;
  font-size: 14px;
  line-height: 1.85;
  overflow-wrap: anywhere;
}
.home-now-panel li::marker {
  color: var(--accent);
}
.home-now-panel time {
  display: block;
  margin-top: 18px;
  color: var(--muted);
  font-size: 12px;
}
@media (max-width: 600px) {
  .home-now-trigger,
  .home-now-panel {
    --now-edge: 16px;
  }
}
@media print {
  .home-now-trigger,
  .home-now-panel {
    display: none;
  }
}
</style>
