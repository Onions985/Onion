<script setup lang="ts">
const shell = ref<HTMLElement>()
let observer: ResizeObserver | undefined
onMounted(() => {
  const header = shell.value?.querySelector<HTMLElement>('.site-header')
  if (!header) return
  const measure = () =>
    shell.value?.style.setProperty('--site-header-height', `${header.getBoundingClientRect().height}px`)
  measure()
  observer = new ResizeObserver(measure)
  observer.observe(header)
})
onBeforeUnmount(() => observer?.disconnect())
</script>
<template>
  <div ref="shell" class="site-shell">
    <SiteHeader />
    <main id="main-content"><slot /></main>
    <SiteFooter />
  </div>
</template>
