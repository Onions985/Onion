import { test } from 'node:test'
import assert from 'node:assert/strict'
import { renderMarkdown, imageReferences } from '../server/utils/markdown.ts'
import { hashPassword, verifyPassword } from '../server/utils/password.ts'
import { draftSchema } from '../shared/validation.ts'
test('passwords are salted, verifiable, and fail closed', async () => {
  const a = await hashPassword('a-long-example-password'),
    b = await hashPassword('a-long-example-password')
  assert.notEqual(a, b)
  assert.equal(await verifyPassword('a-long-example-password', a), true)
  assert.equal(await verifyPassword('wrong', a), false)
  assert.equal(await verifyPassword('anything', 'broken'), false)
})
test('Markdown supports rich text and tables while removing executable HTML', () => {
  const html = renderMarkdown(
    '# Heading\n\n**bold** <u>underline</u> <mark>marked</mark>\n\n| A | B |\n|---|---|\n| one | two |\n\n<script>alert(1)</script><img src="https://evil.test/a.png" onerror="alert(2)"><a href="javascript:alert(3)">bad</a><iframe src="https://evil.test"></iframe>',
  )
  assert.match(html, /<h1>Heading/)
  assert.match(html, /<strong>bold/)
  assert.match(html, /<u>underline/)
  assert.match(html, /<table>/)
  assert.match(html, /<mark>marked/)
  assert.doesNotMatch(html, /<script|<iframe|onerror|javascript:|evil\.test/)
})
test('image references accept only local uploaded media, including raw HTML', () => {
  const id = '550e8400-e29b-41d4-a716-446655440000'
  assert.deepEqual(imageReferences(`![alt](/api/media/${id})\n<img src="/api/media/${id}">`, id), [id])
  for (const text of [
    '![alt](https://outside.test/image.png)',
    '<img src="data:image/png;base64,test">',
    '![alt](/api/media/../../secret)',
  ])
    assert.throws(() => imageReferences(text))
  assert.match(renderMarkdown(`![alt](/api/media/${id})`), /loading="lazy"/)
})
test('draft validation rejects unsafe links and malformed slugs', () => {
  const body = {
    locale: 'zh',
    slug: '一篇博客',
    title: '标题',
    markdown: '正文',
    expectedVersion: 0,
    metadata: {},
  }
  assert.equal(draftSchema.safeParse(body).success, true)
  assert.equal(draftSchema.safeParse({ ...body, slug: '../secret' }).success, false)
  assert.equal(
    draftSchema.safeParse({ ...body, metadata: { projectUrl: 'javascript:alert(1)' } }).success,
    false,
  )
  assert.equal(draftSchema.safeParse({ ...body, expectedVersion: -1 }).success, false)
})
