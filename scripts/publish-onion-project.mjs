import assert from 'node:assert/strict'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { draftSchema } from '../shared/validation.ts'

const database = new URL(process.env.DATABASE_URL)
assert(
  database.hostname === '127.0.0.1' && database.port === '3317' && database.pathname === '/onion',
  'Local Onion database only',
)
const base = 'http://127.0.0.1:3000'
const project = JSON.parse(await readFile('docs/projects/onion.json', 'utf8'))
const markdown = await readFile('docs/projects/onion.md', 'utf8')
const draft = draftSchema.parse({ ...project, markdown, locale: 'zh', expectedVersion: 0 })
const cookies = new Map()
async function request(path, method = 'GET', body) {
  const response = await fetch(base + path, {
    method,
    headers: {
      cookie: [...cookies].map(([k, v]) => `${k}=${v}`).join('; '),
      ...(method !== 'GET' ? { 'x-onion-request': '1' } : {}),
      ...(body && !(body instanceof FormData) ? { 'content-type': 'application/json' } : {}),
    },
    body: body ? (body instanceof FormData ? body : JSON.stringify(body)) : undefined,
  })
  for (const raw of response.headers.getSetCookie()) {
    const pair = raw.split(';')[0],
      index = pair.indexOf('=')
    cookies.set(pair.slice(0, index), pair.slice(index + 1))
  }
  const data = await response.json()
  assert(response.ok, `${method} ${path}: ${response.status} ${data.statusMessage || ''}`)
  return data
}
await request('/api/auth/login', 'POST', {
  email: process.env.ADMIN_EMAIL,
  password: process.env.ADMIN_PASSWORD,
})
try {
  const items = []
  for (let page = 1; ; page++) {
    const result = await request(`/api/admin/content?kind=project&page=${page}`)
    items.push(...result.items)
    if (result.page * result.pageSize >= result.total) break
  }
  const existing = items.find(
    (item) => item.translations.zh?.slug === project.slug || item.translations.zh?.title === project.title,
  )
  await mkdir('.runtime/onion-project', { recursive: true })
  await writeFile(`.runtime/onion-project/before-${Date.now()}.json`, JSON.stringify(items, null, 2))
  let item
  if (existing) {
    item = await request(`/api/admin/content/${existing.id}`)
    const current = item.translations.zh
    assert.equal(current.markdown, markdown, 'Existing edits preserved')
    assert.equal(current.title, draft.title, 'Existing title preserved')
    assert.equal(current.summary, draft.summary, 'Existing summary preserved')
    assert.deepEqual(current.metadata, draft.metadata, 'Existing project settings preserved')
    assert(current.coverId, 'Existing cover is required')
    assert(
      !current.publishedRevisionId || current.publishedRevisionId === current.draftRevisionId,
      'Unpublished edits preserved',
    )
  } else {
    const form = new FormData()
    form.append(
      'file',
      new Blob([await readFile('docs/projects/onion/screenshots/home.png')], { type: 'image/png' }),
      'onion-project-cover.png',
    )
    const cover = await request('/api/admin/media', 'POST', form)
    item = await request('/api/admin/content', 'POST', { ...draft, kind: 'project', coverId: cover.id })
    await writeFile(
      '.runtime/onion-project/created.json',
      JSON.stringify({ id: item.id, coverId: cover.id }, null, 2),
    )
  }
  if (!item.translations.zh.publishedRevisionId) {
    item = await request(`/api/admin/content/${item.id}/publish`, 'POST', {
      locale: 'zh',
      expectedVersion: item.translations.zh.version,
    })
  }
  const live = await request(`/api/content/${project.slug}?locale=zh&kind=project`)
  assert.equal(live.title, draft.title)
  assert.equal(live.metadata.projectModules.length, 6)
  assert.match(live.html, /href="\/zh"/)
  assert.equal((await fetch(base + `/api/media/${live.coverId}`)).status, 200)
  await writeFile(
    '.runtime/onion-project/result.json',
    JSON.stringify({ id: item.id, slug: live.slug, coverId: live.coverId }, null, 2),
  )
  console.log(
    JSON.stringify({
      title: live.title,
      url: `${base}/zh/projects/${live.slug}`,
      modules: live.metadata.projectModules.length,
      published: true,
    }),
  )
} finally {
  await request('/api/auth/logout', 'POST')
}
