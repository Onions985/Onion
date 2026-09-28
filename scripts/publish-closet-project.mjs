import assert from 'node:assert/strict'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { draftSchema } from '../shared/validation.ts'

const database = new URL(process.env.DATABASE_URL)
assert(
  database.hostname === '127.0.0.1' && database.port === '3317' && database.pathname === '/onion',
  'Local Onion database only',
)
const base = 'http://127.0.0.1:3000'
const project = JSON.parse(await readFile('docs/projects/closet.json', 'utf8'))
const evidence = JSON.parse(await readFile('docs/projects/closet/source-evidence.json', 'utf8'))
const markdown = await readFile('docs/projects/closet.md', 'utf8')
const draft = draftSchema.parse({ ...project, markdown, locale: 'zh', expectedVersion: 0 })
const cookies = new Map()
async function request(path, method = 'GET', body) {
  const response = await fetch(base + path, {
    method,
    headers: {
      cookie: [...cookies].map(([key, value]) => `${key}=${value}`).join('; '),
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
  await mkdir('.runtime/closet-project', { recursive: true })
  await writeFile(`.runtime/closet-project/before-${Date.now()}.json`, JSON.stringify(items, null, 2))
  let item
  if (existing) {
    item = await request(`/api/admin/content/${existing.id}`)
    const current = item.translations.zh
    assert.equal(current.markdown, markdown, 'Existing edits preserved')
    assert.equal(current.title, draft.title, 'Existing title preserved')
    assert.equal(current.summary, draft.summary, 'Existing summary preserved')
    assert.deepEqual(
      { ...current.metadata, projectScreenshots: [] },
      draft.metadata,
      'Existing project settings preserved',
    )
    assert(current.coverId && current.metadata.projectScreenshots.length === evidence.screenshots.length)
    assert(
      !current.publishedRevisionId || current.publishedRevisionId === current.draftRevisionId,
      'Unpublished edits preserved',
    )
  } else {
    const screenshots = []
    for (const shot of evidence.screenshots) {
      assert.match(shot.file, /^screenshots\/[a-z-]+\.png$/)
      const form = new FormData()
      form.append(
        'file',
        new Blob([await readFile(`docs/projects/closet/${shot.file}`)], { type: 'image/png' }),
        `closet-${shot.file.split('/').pop()}`,
      )
      const media = await request('/api/admin/media', 'POST', form)
      screenshots.push({ mediaId: media.id, caption: shot.caption })
    }
    item = await request('/api/admin/content', 'POST', {
      ...draft,
      kind: 'project',
      coverId: screenshots[0].mediaId,
      metadata: { ...draft.metadata, projectScreenshots: screenshots },
    })
    await writeFile(
      '.runtime/closet-project/created.json',
      JSON.stringify({ id: item.id, screenshots }, null, 2),
    )
  }
  if (!item.translations.zh.publishedRevisionId) {
    await request(`/api/admin/content/${item.id}/publish`, 'POST', {
      locale: 'zh',
      expectedVersion: item.translations.zh.version,
    })
  }
  const live = await request(`/api/content/${project.slug}?locale=zh&kind=project`)
  assert.equal(live.title, draft.title)
  assert.equal(live.metadata.projectModules.length, 6)
  assert.equal(live.metadata.projectUrl, 'https://gitee.com/closet_2')
  assert.equal(live.metadata.projectScreenshots.length, 2)
  for (const shot of live.metadata.projectScreenshots) {
    const response = await fetch(`${base}/api/media/${shot.mediaId}`)
    assert.equal(response.status, 200)
    await response.arrayBuffer()
  }
  const result = {
    id: item.id,
    slug: live.slug,
    coverId: live.coverId,
    url: `${base}/zh/projects/${live.slug}`,
    screenshots: 2,
    published: true,
  }
  await writeFile('.runtime/closet-project/result.json', JSON.stringify(result, null, 2))
  console.log(JSON.stringify(result))
} finally {
  await request('/api/auth/logout', 'POST')
}
