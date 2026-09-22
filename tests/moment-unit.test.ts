import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { draftSchema } from '../shared/validation.ts'
import { normalizeMomentDraft } from '../shared/moment.ts'
import { renderMarkdown, markdownText } from '../server/utils/markdown.ts'
const base = { locale: 'zh', slug: 'moment-test', title: 'placeholder', markdown: '', expectedVersion: 0 }
test('moments enforce nine distinct uploaded IDs and derive the cover from photo order', () => {
  const images = Array.from({ length: 10 }, () => randomUUID())
  assert.equal(
    draftSchema.safeParse({ ...base, metadata: { moment: { text: '', imageIds: images } } }).success,
    false,
  )
  assert.equal(
    draftSchema.safeParse({ ...base, metadata: { moment: { text: '', imageIds: [images[0], images[0]] } } })
      .success,
    false,
  )
  const draft = draftSchema.parse({
    ...base,
    coverId: images[9],
    metadata: { moment: { text: '', imageIds: images.slice(0, 9) } },
  })
  assert.equal(normalizeMomentDraft(draft).coverId, images[0])
  draft.metadata.moment!.imageIds.reverse()
  assert.equal(normalizeMomentDraft(draft).coverId, images[8])
  draft.metadata.moment!.imageIds = []
  assert.equal(normalizeMomentDraft(draft).coverId, null)
})
test('moment text stays plain and legacy editor text preserves paragraph boundaries', () => {
  const draft = draftSchema.parse({
    ...base,
    metadata: {
      moment: { text: '<script>alert(1)</script>\n**hello**\n![x](https://example.com/x.png)', imageIds: [] },
    },
  })
  const html = renderMarkdown(normalizeMomentDraft(draft).markdown)
  assert.doesNotMatch(html, /<script|<img|<strong>/)
  assert.match(html, /&lt;script&gt;/)
  assert.equal(markdownText('# A\n\n**B** &amp; C'), 'A\n\n\nB & C')
})
