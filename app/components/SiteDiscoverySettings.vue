<script setup lang="ts">
import type { SiteConfig } from '../../shared/types'
const config = defineModel<SiteConfig>({ required: true })
const { t, locale } = useSite()
const request = useRequestFetch()
const { data: choices, error } = await useAsyncData('published-choices', () =>
  request<{ items: { id: string; kind: string; title: string }[] }>('/api/admin/published-content'),
)
config.value.startHere ??= { blogIds: [], projectId: null }
config.value.now ??= { zh: '', en: '', updatedOn: '' }
config.value.socialLinks ??= []
const first = ref(config.value.startHere.blogIds[0] || '')
const second = ref(config.value.startHere.blogIds[1] || '')
watch([first, second], ([a, b]) => {
  config.value.startHere!.blogIds = [...new Set([a, b].filter(Boolean))]
})
function dateUpdate() {
  const now = config.value.now!
  if (now.zh.trim() || now.en.trim()) {
    const date = new Date()
    now.updatedOn = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  } else now.updatedOn = ''
}
const examples = computed(() =>
  locale.value === 'zh'
    ? '示例（请改成你的真实近况）：\n正在打磨一个独立产品的使用体验。\n整理最近一次开发中的技术取舍。\n为下一次旅行或跑步做准备。'
    : 'Examples — replace with your actual updates:\nRefining the experience of an independent project.\nWriting about a recent engineering decision.\nPlanning the next trip or run.',
)
</script>
<template>
  <section class="discovery-settings">
    <h2>{{ t('admin.discovery') }}</h2>
    <p class="editor-help">{{ t('admin.discoveryHint') }}</p>
    <p v-if="error" class="field-error">{{ t('error.generic') }}</p>
    <div class="form-grid">
      <label class="field"
        ><span>{{ t('admin.firstRead') }}</span
        ><select v-model="first">
          <option value="">{{ t('admin.automatic') }}</option>
          <option
            v-for="item in choices?.items.filter((item) => item.kind === 'blog')"
            :key="item.id"
            :value="item.id"
            :disabled="item.id === second"
          >
            {{ item.title }}
          </option>
        </select></label
      >
      <label class="field"
        ><span>{{ t('admin.secondRead') }}</span
        ><select v-model="second">
          <option value="">{{ t('admin.automatic') }}</option>
          <option
            v-for="item in choices?.items.filter((item) => item.kind === 'blog')"
            :key="item.id"
            :value="item.id"
            :disabled="item.id === first"
          >
            {{ item.title }}
          </option>
        </select></label
      >
      <label class="field wide"
        ><span>{{ t('admin.selectedProject') }}</span
        ><select v-model="config.startHere!.projectId">
          <option :value="null">{{ t('admin.automatic') }}</option>
          <option
            v-for="item in choices?.items.filter((item) => item.kind === 'project')"
            :key="item.id"
            :value="item.id"
          >
            {{ item.title }}
          </option>
        </select></label
      >
      <label v-for="lang in ['zh', 'en'] as const" :key="lang" class="field"
        ><span>{{ t('now.title') }} · {{ lang === 'zh' ? '中文' : 'English' }}</span
        ><textarea
          v-model="config.now![lang]"
          rows="5"
          maxlength="1200"
          :placeholder="examples"
          @input="dateUpdate"
        />
      </label>
      <label class="field"
        ><span>{{ t('now.updated') }}</span
        ><input
          v-model="config.now!.updatedOn"
          type="date"
          :required="Boolean(config.now!.zh || config.now!.en)"
      /></label>
    </div>
    <p class="editor-help">{{ t('admin.nowHint') }}</p>
    <h2>{{ t('follow.title') }}</h2>
    <div v-for="(link, index) in config.socialLinks" :key="index" class="social-editor-row">
      <label class="field"
        ><span>{{ t('admin.socialLabel') }}</span
        ><input v-model="link.label" maxlength="40" required
      /></label>
      <label class="field"
        ><span>{{ t('admin.socialUrl') }}</span
        ><input v-model="link.url" type="url" placeholder="https://" maxlength="1000" required
      /></label>
      <button type="button" class="small-button" @click="config.socialLinks!.splice(index, 1)">
        {{ t('admin.remove') }}
      </button>
    </div>
    <button
      type="button"
      class="button"
      :disabled="config.socialLinks!.length >= 6"
      @click="config.socialLinks!.push({ label: '', url: '' })"
    >
      <AppIcon name="plus" :size="16" />{{ t('admin.addSocial') }}
    </button>
  </section>
</template>
