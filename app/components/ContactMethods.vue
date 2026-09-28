<script setup lang="ts">
import type { SiteConfig } from '../../shared/types'
import { emailContactUrl, qqContactUrl } from '#shared/contact'
const props = defineProps<{ contact: NonNullable<SiteConfig['contact']> }>()
const { t } = useSite()
const { notify } = useFeedback()
const dialog = ref<HTMLDialogElement>()
const dialogId = useId()
const mobile = ref(false)
onMounted(() => {
  mobile.value =
    /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
})
const qqUrl = computed(() => qqContactUrl(props.contact.qq || '', mobile.value))
const copyStatus = ref('')
async function copy(value: string) {
  try {
    await navigator.clipboard.writeText(value)
    copyStatus.value = t('contact.copied')
    notify(copyStatus.value)
  } catch {
    copyStatus.value = t('contact.copyFailed')
    notify(copyStatus.value, true)
  }
}
function openWechat() {
  copyStatus.value = ''
  dialog.value?.showModal()
}
</script>
<template>
  <div class="contact-list contact-actions">
    <div v-if="contact.qq" class="contact-method">
      <a :href="qqUrl" class="contact-card contact-action">
        <AppIcon name="chat" :size="23" /><span class="contact-value"
          ><span>{{ t('about.qq') }}</span
          ><strong>{{ contact.qq }}</strong
          ><small>{{ t('contact.openQq') }}</small></span
        ><AppIcon name="arrow" :size="16" />
      </a>
      <button type="button" class="contact-copy" @click="copy(contact.qq)">{{ t('contact.copyQq') }}</button>
    </div>
    <div v-if="contact.wechat || contact.wechatQrId" class="contact-method">
      <button
        type="button"
        class="contact-card contact-action"
        aria-haspopup="dialog"
        :aria-controls="dialogId"
        @click="openWechat"
      >
        <AppIcon name="chat" :size="23" /><span class="contact-value"
          ><span>{{ t('about.wechat') }}</span
          ><strong>{{ contact.wechat || t('contact.wechatQr') }}</strong
          ><small>{{ t('contact.addWechat') }}</small></span
        ><AppIcon name="right" :size="16" />
      </button>
      <button v-if="contact.wechat" type="button" class="contact-copy" @click="copy(contact.wechat)">
        {{ t('contact.copyWechat') }}
      </button>
    </div>
    <div v-if="contact.email" class="contact-method">
      <a :href="emailContactUrl(contact.email)" class="contact-card contact-action">
        <AppIcon name="mail" :size="23" /><span class="contact-value"
          ><span>{{ t('about.email') }}</span
          ><strong>{{ contact.email }}</strong
          ><small>{{ t('contact.writeEmail') }}</small></span
        ><AppIcon name="arrow" :size="16" />
      </a>
      <button type="button" class="contact-copy" @click="copy(contact.email)">
        {{ t('contact.copyEmail') }}
      </button>
    </div>
  </div>
  <dialog
    :id="dialogId"
    ref="dialog"
    class="contact-dialog"
    :aria-labelledby="`${dialogId}-title`"
    @click="$event.target === dialog && dialog?.close()"
  >
    <header>
      <h2 :id="`${dialogId}-title`">{{ t('contact.addWechat') }}</h2>
      <button type="button" class="icon-button" :aria-label="t('close')" autofocus @click="dialog?.close()">
        <AppIcon name="close" />
      </button>
    </header>
    <template v-if="contact.wechatQrId">
      <img :src="`/api/media/${contact.wechatQrId}`" :alt="t('contact.wechatQr')" class="wechat-qr" />
      <p>{{ t('contact.wechatScan') }}</p>
      <a :href="`/api/media/${contact.wechatQrId}`" download="wechat-qr" class="button">{{
        t('contact.saveQr')
      }}</a>
    </template>
    <p v-else>{{ t('contact.wechatHint') }}</p>
    <div v-if="contact.wechat" class="wechat-id">
      <label :for="`${dialogId}-wechat`">{{ t('about.wechat') }}</label>
      <input
        :id="`${dialogId}-wechat`"
        :value="contact.wechat"
        readonly
        @click="($event.target as HTMLInputElement).select()"
      />
      <button type="button" class="button primary" @click="copy(contact.wechat)">
        {{ t('contact.copyWechat') }}
      </button>
    </div>
    <p class="contact-copy-status" role="status" aria-live="polite">{{ copyStatus }}</p>
  </dialog>
</template>
<style scoped>
.contact-actions {
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 260px), 1fr));
  align-items: start;
}
.contact-method {
  min-width: 0;
}
.contact-action {
  width: 100%;
  text-align: left;
  color: inherit;
  grid-template-columns: 24px minmax(0, 1fr) 16px;
  align-items: center;
  gap: 16px;
}
.contact-action:hover {
  border-color: var(--accent);
}
.contact-action > svg {
  grid-row: auto;
}
.contact-value {
  display: grid;
  gap: 3px;
  min-width: 0;
}
.contact-value > span {
  font-size: 12px;
  color: var(--muted);
}
.contact-value strong {
  font-size: 18px;
  font-weight: 500;
  overflow-wrap: anywhere;
  user-select: text;
}
.contact-value small {
  color: var(--accent);
  font-size: 12px;
}
.contact-copy {
  border: 0;
  background: transparent;
  color: var(--muted);
  font-size: 12px;
  padding: 8px 4px;
}
.contact-copy:hover {
  color: var(--accent);
}
.contact-dialog {
  width: min(440px, calc(100vw - 32px));
  max-height: calc(100dvh - 48px);
  overflow: auto;
  padding: 24px;
  border: 1px solid var(--line);
  border-radius: 20px;
  background: var(--surface);
  color: var(--fg);
}
.contact-dialog::backdrop {
  background: #0008;
}
.contact-dialog header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  margin-bottom: 18px;
}
.contact-dialog > header > h2 {
  font-size: 21px;
  margin: 0;
}
.contact-dialog p {
  color: var(--muted);
  font-size: 14px;
  margin: 12px 0;
}
.wechat-qr {
  max-height: 44dvh;
  width: 100%;
  object-fit: contain;
  padding: 12px;
  background: #fff;
  border-radius: 10px;
}
.wechat-id {
  display: grid;
  gap: 10px;
  margin-top: 20px;
}
.wechat-id label {
  color: var(--muted);
  font-size: 12px;
}
.wechat-id input {
  width: 100%;
  min-width: 0;
  padding: 10px 12px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--soft);
  color: var(--fg);
}
.contact-copy-status {
  min-height: 1.5em;
}
@media (max-width: 600px) {
  .contact-actions {
    grid-template-columns: 1fr;
  }
}
</style>
