<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    label: string
    placeholder?: string
    rows?: number
    disabled?: boolean
  }>(),
  { placeholder: '', rows: 4, disabled: false },
)
const body = defineModel<string>({ required: true })
const { t } = useSite()
const id = useId()
const root = useTemplateRef('root')
const textarea = useTemplateRef('textarea')
const toggle = useTemplateRef('toggle')
const picker = useTemplateRef('picker')
const open = ref(false)
const selection = ref({ start: body.value.length, end: body.value.length })
const maxLength = 2000
const emojis = computed<{ value: string; label: string }[]>(() => {
  try {
    const options = JSON.parse(t('comments.emojiOptions'))
    return Array.isArray(options)
      ? options.filter(
          (option) =>
            typeof option?.value === 'string' && option.value.length > 0 && typeof option?.label === 'string',
        )
      : []
  } catch {
    return []
  }
})
const available = computed(
  () =>
    maxLength -
    body.value.length +
    Math.min(selection.value.end, body.value.length) -
    Math.min(selection.value.start, body.value.length),
)
function rememberSelection() {
  if (textarea.value)
    selection.value = {
      start: textarea.value.selectionStart,
      end: textarea.value.selectionEnd,
    }
}
async function togglePicker() {
  open.value = !open.value
  if (open.value) {
    await nextTick()
    const first = picker.value?.querySelector<HTMLButtonElement>('.emoji-choice:not(:disabled)')
    ;(first || picker.value?.querySelector<HTMLButtonElement>('.emoji-close'))?.focus()
  }
}
async function insertEmoji(value: string) {
  if (props.disabled || value.length > available.value) return
  const start = Math.min(selection.value.start, body.value.length)
  const end = Math.min(selection.value.end, body.value.length)
  body.value = body.value.slice(0, start) + value + body.value.slice(end)
  selection.value = { start: start + value.length, end: start + value.length }
  open.value = false
  await nextTick()
  textarea.value?.focus({ preventScroll: true })
  textarea.value?.setSelectionRange(selection.value.start, selection.value.end)
}
function closePicker() {
  open.value = false
  toggle.value?.focus({ preventScroll: true })
}
function escapePicker(event: KeyboardEvent) {
  if (!open.value || event.key !== 'Escape') return
  event.preventDefault()
  event.stopPropagation()
  closePicker()
}
function outside(event: Event) {
  if (event.target instanceof Node && !root.value?.contains(event.target)) open.value = false
}
watch(
  () => props.disabled,
  (disabled) => {
    if (disabled) open.value = false
  },
)
watch(body, (value) => {
  if (!value) selection.value = { start: 0, end: 0 }
})
onMounted(() => {
  document.addEventListener('pointerdown', outside)
  document.addEventListener('focusin', outside)
})
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', outside)
  document.removeEventListener('focusin', outside)
})
</script>

<template>
  <div ref="root" class="comment-input" @keydown="escapePicker">
    <label class="field" :for="id">
      <span>{{ label }}</span>
      <textarea
        :id="id"
        ref="textarea"
        v-model="body"
        required
        minlength="1"
        :maxlength="maxLength"
        :rows="rows"
        :placeholder="placeholder"
        :disabled="disabled"
        @input="rememberSelection"
        @select="rememberSelection"
        @click="rememberSelection"
        @keyup="rememberSelection"
        @blur="rememberSelection"
      />
    </label>
    <div class="comment-input-toolbar">
      <button
        ref="toggle"
        type="button"
        class="emoji-toggle"
        :class="{ active: open }"
        :disabled="disabled"
        :aria-expanded="open"
        :aria-controls="`${id}-emojis`"
        @click="togglePicker"
      >
        <AppIcon name="smile" :size="20" />{{ t('comments.emoji') }}
      </button>
      <span class="comment-input-count">{{ body.length }} / {{ maxLength }}</span>
      <slot />
    </div>
    <div
      v-if="open"
      :id="`${id}-emojis`"
      ref="picker"
      class="emoji-picker"
      role="group"
      :aria-label="t('comments.chooseEmoji')"
    >
      <div class="emoji-picker-heading">
        <span>{{ t('comments.chooseEmoji') }}</span>
        <button type="button" class="emoji-close" :aria-label="t('comments.closeEmoji')" @click="closePicker">
          <AppIcon name="close" :size="16" />
        </button>
      </div>
      <div class="emoji-grid">
        <button
          v-for="emoji in emojis"
          :key="emoji.value"
          type="button"
          class="emoji-choice"
          :title="emoji.label"
          :aria-label="emoji.label"
          :disabled="emoji.value.length > available"
          @click="insertEmoji(emoji.value)"
        >
          <span aria-hidden="true">{{ emoji.value }}</span>
        </button>
      </div>
      <p
        v-if="emojis.length && emojis.every((emoji) => emoji.value.length > available)"
        class="emoji-limit"
        role="status"
      >
        {{ t('comments.emojiLimit') }}
      </p>
    </div>
  </div>
</template>

<style scoped>
.comment-input {
  min-width: 0;
}
.comment-input .field {
  max-width: none;
  margin-bottom: 10px;
}
.comment-input-toolbar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
}
.emoji-toggle,
.emoji-choice,
.emoji-close {
  border: 0;
  padding: 0;
  background: transparent;
}
.emoji-toggle {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 8px 10px;
  color: var(--muted);
  border: 1px solid transparent;
  border-radius: 8px;
  font-size: 13px;
}
.emoji-toggle.active,
.emoji-toggle:hover:not(:disabled) {
  background: var(--accent-soft);
  color: var(--accent);
}
.comment-input-count {
  margin-right: auto;
  color: var(--muted);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}
.emoji-picker {
  width: min(100%, 360px);
  margin-top: 12px;
  padding: 12px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: var(--surface);
  box-shadow: 0 8px 28px #0000000a;
}
.emoji-picker-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
  padding-left: 5px;
  color: var(--muted);
  font-size: 12px;
}
.emoji-close {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  border-radius: 7px;
}
.emoji-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(36px, 1fr));
  gap: 4px;
}
.emoji-choice {
  display: grid;
  place-items: center;
  min-height: 38px;
  border-radius: 8px;
  font-family: 'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', sans-serif;
  font-size: 24px;
  line-height: 1;
}
.emoji-choice:hover:not(:disabled),
.emoji-close:hover {
  background: var(--soft);
}
.emoji-choice:focus-visible,
.emoji-toggle:focus-visible,
.emoji-close:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
.emoji-choice:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}
.emoji-limit {
  margin: 10px 4px 0;
  color: var(--muted);
  font-size: 12px;
}
</style>
