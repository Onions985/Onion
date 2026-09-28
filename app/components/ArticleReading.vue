<script setup lang="ts">
import type { ContentDetail } from '../../shared/types'
const props = defineProps<{ article: ContentDetail }>()
const { t, contentUrl } = useSite()
const prose = ref<HTMLElement>()
const active = ref('')
const feedback = ref('')
let observer: IntersectionObserver | undefined
const removers: (() => void)[] = []
const timers = new Set<ReturnType<typeof setTimeout>>()
function cleanup() {
  observer?.disconnect()
  removers.splice(0).forEach((remove) => remove())
  timers.forEach(clearTimeout)
  timers.clear()
}
async function enhance() {
  cleanup()
  await nextTick()
  if (!prose.value) return
  observer = new IntersectionObserver(
    (entries) => {
      const first = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]
      if (first) active.value = first.target.id
    },
    { rootMargin: '-10% 0px -60% 0px' },
  )
  prose.value.querySelectorAll('h2[id],h3[id],h4[id]').forEach((heading) => observer!.observe(heading))
  prose.value.querySelectorAll('pre').forEach((pre) => {
    const code = pre.querySelector('code')
    if (!code) return
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'copy-code'
    button.textContent = t('reading.copy')
    const copy = async () => {
      try {
        await navigator.clipboard.writeText(code.textContent || '')
        button.textContent = t('reading.copied')
        feedback.value = t('reading.copied')
      } catch {
        feedback.value = t('reading.copyFailed')
      }
      const timer = setTimeout(() => {
        button.textContent = t('reading.copy')
        timers.delete(timer)
      }, 2000)
      timers.add(timer)
    }
    button.addEventListener('click', copy)
    pre.append(button)
    removers.push(() => {
      button.removeEventListener('click', copy)
      button.remove()
    })
  })
}
onMounted(enhance)
watch(() => props.article.html, enhance, { flush: 'post' })
onBeforeUnmount(cleanup)
</script>
<template>
  <div class="article-reading" :class="{ 'has-toc': article.headings.length > 1 }">
    <aside v-if="article.headings.length > 1" class="article-toc">
      <details open>
        <summary>{{ t('reading.contents') }}</summary>
        <nav :aria-label="t('reading.contents')">
          <a
            v-for="heading in article.headings"
            :key="heading.id"
            :href="`#${heading.id}`"
            :class="{ nested: heading.level > 2, current: active === heading.id }"
            :aria-current="active === heading.id ? 'location' : undefined"
            @click="active = heading.id"
            >{{ heading.text }}</a
          >
        </nav>
      </details>
    </aside>
    <div ref="prose" class="prose article-prose" v-html="article.html" />
  </div>
  <p class="sr-only" role="status" aria-live="polite">{{ feedback }}</p>
  <nav
    v-if="article.seriesNavigation.previous || article.seriesNavigation.next"
    class="series-navigation"
    :aria-label="t('reading.series')"
  >
    <p>{{ t('reading.series') }} · {{ article.metadata.series?.name }}</p>
    <div>
      <NuxtLink v-if="article.seriesNavigation.previous" :to="contentUrl(article.seriesNavigation.previous)"
        ><small>← {{ t('reading.previous') }}</small
        ><strong>{{ article.seriesNavigation.previous.title }}</strong></NuxtLink
      ><NuxtLink v-if="article.seriesNavigation.next" :to="contentUrl(article.seriesNavigation.next)"
        ><small>{{ t('reading.next') }} →</small
        ><strong>{{ article.seriesNavigation.next.title }}</strong></NuxtLink
      >
    </div>
  </nav>
  <section v-if="article.related.length" class="related-reading">
    <h2>{{ t('reading.related') }}</h2>
    <div class="selection-grid">
      <NuxtLink v-for="item in article.related" :key="item.id" :to="contentUrl(item)" class="selection-card"
        ><h3>{{ item.title }}</h3>
        <p>{{ item.summary }}</p></NuxtLink
      >
    </div>
  </section>
</template>
