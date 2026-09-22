<script setup lang="ts">
import { MdEditor, config, type ToolbarNames } from 'md-editor-v3'
import DOMPurify from 'dompurify'
import 'md-editor-v3/lib/style.css'
const model = defineModel<string>({ required: true }),
  emit = defineEmits<{ save: [] }>(),
  { locale, theme, t } = useSite(),
  { fail } = useFeedback()
const systemDark = ref(false),
  uploading = ref(false),
  mobile = ref(false)
const resize = () => {
  mobile.value = window.innerWidth <= 480
}
let mediaQuery: MediaQueryList
const change = (event: MediaQueryListEvent) => (systemDark.value = event.matches)
onMounted(() => {
  resize()
  window.addEventListener('resize', resize)
  mediaQuery = window.matchMedia('(prefers-color-scheme:dark)')
  systemDark.value = mediaQuery.matches
  mediaQuery.addEventListener('change', change)
})
onUnmounted(() => {
  mediaQuery?.removeEventListener('change', change)
  window.removeEventListener('resize', resize)
})
config({ markdownItConfig: (md) => md.set({ html: true }), markdownItPlugins: () => [] })
const tools: ToolbarNames[] = [
  'bold',
  'underline',
  'italic',
  'strikeThrough',
  '-',
  'title',
  'quote',
  'unorderedList',
  'orderedList',
  '-',
  'codeRow',
  'code',
  'link',
  'table',
  '-',
  'revoke',
  'next',
  'save',
  'preview',
  'previewOnly',
  'catalog',
]
function sanitize(html: string) {
  const clean = DOMPurify.sanitize(html, {
    FORBID_TAGS: ['iframe', 'style', 'script', 'form', 'video', 'audio', 'object', 'embed'],
    FORBID_ATTR: ['style'],
  })
  const doc = new DOMParser().parseFromString(clean, 'text/html')
  doc.querySelectorAll('img').forEach((img) => {
    if (!/^\/api\/media\/[a-f0-9-]{36}$/i.test(img.getAttribute('src') || '')) img.remove()
  })
  return doc.body.innerHTML
}
async function upload(files: File[], callback?: (urls: string[]) => void) {
  uploading.value = true
  try {
    const urls: string[] = []
    for (const file of files) {
      const body = new FormData()
      body.append('file', file)
      const result = await apiWrite<{ url: string }>('/api/admin/media', 'POST', body)
      urls.push(result.url)
    }
    if (callback) callback(urls)
    else model.value += urls.map((url) => `\n\n![image](${url})`).join('')
  } catch (e) {
    fail(e)
  } finally {
    uploading.value = false
  }
}
function choose(event: Event) {
  const input = event.target as HTMLInputElement
  if (input.files?.length) void upload([...input.files])
  input.value = ''
}
</script>
<template>
  <div>
    <div class="editor-top">
      <p class="editor-help">{{ t('admin.editorHelp') }}</p>
      <label class="button upload-button"
        ><AppIcon name="image" :size="15" />{{ t(uploading ? 'loading' : 'admin.upload')
        }}<input
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          :disabled="uploading"
          multiple
          :aria-label="t('admin.upload')"
          @change="choose"
      /></label>
    </div>
    <div class="editor-frame">
      <MdEditor
        v-model="model"
        :preview="!mobile"
        :language="locale === 'zh' ? 'zh-CN' : 'en-US'"
        :theme="theme === 'dark' || (theme === 'system' && systemDark) ? 'dark' : 'light'"
        :toolbars="tools"
        :sanitize="sanitize"
        no-mermaid
        no-katex
        no-echarts
        no-prettier
        no-highlight
        no-img-zoom-in
        @on-upload-img="upload"
        @on-save="emit('save')"
      />
    </div>
  </div>
</template>
