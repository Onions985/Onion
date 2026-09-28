import { test } from 'node:test'
import assert from 'node:assert/strict'
import { renderArticle } from '../server/utils/markdown.ts'
import { canonicalPath, rssDocument, xmlEscape } from '../shared/discovery.ts'
import { configSchema, metadataSchema } from '../shared/validation.ts'
import type { ContentSummary } from '../shared/types.ts'
import { emailContactUrl, hasContact, qqContactUrl } from '../shared/contact.ts'

test('contact actions encode mail addresses and reject protocol injection in QQ numbers', () => {
  assert.equal(emailContactUrl('name+tag?x#y&z@example.test'), 'mailto:name%2Btag%3Fx%23y%26z@example.test')
  assert.match(qqContactUrl('759308541'), /^tencent:\/\/AddContact\//)
  assert.match(qqContactUrl('759308541', true), /^mqqapi:\/\/card\/show_pslcard\?/)
  assert.equal(qqContactUrl('12345&command=other'), '')
  assert.equal(hasContact({ qq: '759308541', wechat: '', email: '' }), true)
  assert.equal(hasContact({ wechat: '', email: '', wechatQrId: 'image-id' }), true)
  assert.equal(hasContact({ wechat: '', email: '' }), false)
})

test('article anchors are deterministic, distinct and retain sanitized code', () => {
  const source =
    '## 重复 **标题**\n\n### `inline`\n\n## 重复 **标题**\n\n```js\nconst a = "<script>"\n```\n\n<script>alert(1)</script>'
  const first = renderArticle(source)
  assert.deepEqual(first, renderArticle(source))
  assert.deepEqual(first.headings, [
    { id: 'section-1', text: '重复 标题', level: 2 },
    { id: 'section-2', text: 'inline', level: 3 },
    { id: 'section-3', text: '重复 标题', level: 2 },
  ])
  for (const heading of first.headings) assert(first.html.includes(`id="${heading.id}"`))
  assert.match(first.html, /&lt;script&gt;/)
  assert.doesNotMatch(first.html, /<script>/)
})

test('canonical paths retain pagination and normalize old tag URLs without tracking', () => {
  assert.equal(
    canonicalPath('/en/writing', { tag: 'C++ / 实战', page: '2', utm_source: 'test' }),
    '/en/tags/C%2B%2B%20%2F%20%E5%AE%9E%E6%88%98?page=2',
  )
  assert.equal(canonicalPath('/zh/projects/', { page: 0 }), '/zh/projects')
  assert.equal(canonicalPath('/zh/posts/example', { page: 2 }), '/zh/posts/example')
})

test('RSS escapes text, uses absolute links, dates and stable per-language identifiers', () => {
  const item = {
    id: 'stable-id',
    kind: 'blog',
    slug: '中文',
    title: '<script>&',
    summary: 'A & B <test>',
    publishedAt: '2026-09-28 00:00:00.000',
    metadata: { tags: ['A&B'] },
  } as ContentSummary
  const feed = rssDocument('https://example.test', 'en', { siteName: 'A&B', description: 'Updates' }, [item])
  assert.match(feed, /&lt;script&gt;&amp;/)
  assert.match(feed, /Mon, 28 Sep 2026 00:00:00 GMT/)
  assert.match(feed, /https:\/\/example.test\/en\/posts\/%E4%B8%AD%E6%96%87/)
  assert.match(feed, /https:\/\/example.test:stable-id:en/)
  assert.doesNotMatch(feed, /<script>/)
  assert.equal(xmlEscape('a\u0000b'), 'ab')
})

test('new settings accept legacy configs but validate updates and external links', () => {
  const legacy = {
    defaultLocale: 'zh',
    defaultTheme: 'system',
    accent: 'lilac',
    avatarId: null,
    navigation: [{ path: '', label: 'nav.home' }],
  }
  assert(configSchema.safeParse(legacy).success)
  assert(!configSchema.safeParse({ ...legacy, now: { zh: 'New work', en: '', updatedOn: '' } }).success)
  assert(!configSchema.safeParse({ ...legacy, now: { zh: '', en: '', updatedOn: '2026-02-30' } }).success)
  for (const url of ['javascript:alert(1)', 'https://', 'https://secret:password@example.test']) {
    assert(!metadataSchema.safeParse({ projectStory: { demoUrl: url } }).success)
    assert(!configSchema.safeParse({ ...legacy, socialLinks: [{ label: 'Profile', url }] }).success)
  }
  assert(
    metadataSchema.safeParse({
      series: { name: 'Building', order: 1 },
      projectStory: { demoUrl: 'https://example.test/watch' },
    }).success,
  )
})
