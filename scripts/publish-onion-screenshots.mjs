import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile, writeFile, mkdir } from 'node:fs/promises'

const database = new URL(process.env.DATABASE_URL)
assert(
  database.hostname === '127.0.0.1' && database.port === '3317' && database.pathname === '/onion',
  'Local Onion database only',
)
const base = 'http://127.0.0.1:3000'
const coverOnly = process.argv.includes('--cover-only')
const manifest = JSON.parse(await readFile('docs/projects/onion/screenshots.json', 'utf8'))
const cookies = new Map()
const cachePath = '.runtime/onion-project/screenshots-uploaded.json'
const cache = JSON.parse(
  await readFile(cachePath, 'utf8').catch((error) => {
    if (error.code === 'ENOENT') return '{}'
    throw error
  }),
)

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
  const publicItem = await request('/api/content/onion?kind=project&locale=zh')
  const item = await request(`/api/admin/content/${publicItem.id}`)
  assert.equal(item.kind, 'project')
  const draft = item.translations.zh
  assert.equal(draft.slug, 'onion')
  assert.equal(draft.draftRevisionId, draft.publishedRevisionId, 'Unpublished edits preserved')
  await mkdir('.runtime/onion-project', { recursive: true })
  await writeFile(
    `.runtime/onion-project/before-screenshots-${Date.now()}.json`,
    JSON.stringify(item, null, 2),
  )

  let coverId = draft.coverId
  const screenshots = []
  for (const entry of manifest.filter((entry) => !coverOnly || entry.cover)) {
    assert.match(entry.file, /^[a-z-]+\.png$/)
    const bytes = await readFile(`docs/projects/onion/screenshots/${entry.file}`)
    const hash = createHash('sha256').update(bytes).digest('hex')
    let asset = cache[entry.file]
    if (!asset || asset.hash !== hash) {
      const form = new FormData()
      form.append('file', new Blob([bytes], { type: 'image/png' }), `onion-${entry.file}`)
      const uploaded = await request('/api/admin/media', 'POST', form)
      asset = { id: uploaded.id, hash }
      cache[entry.file] = asset
      await writeFile(cachePath, JSON.stringify(cache, null, 2))
    }
    if (entry.cover) coverId = asset.id
    screenshots.push({ mediaId: asset.id, caption: entry.caption })
  }
  const metadata = coverOnly ? draft.metadata : { ...draft.metadata, projectScreenshots: screenshots }
  if (draft.coverId !== coverId || JSON.stringify(metadata) !== JSON.stringify(draft.metadata)) {
    const saved = await request(`/api/admin/content/${item.id}/draft`, 'PUT', {
      ...draft,
      coverId,
      metadata,
      expectedVersion: draft.version,
    })
    await request(`/api/admin/content/${item.id}/publish`, 'POST', {
      locale: 'zh',
      expectedVersion: saved.translations.zh.version,
    })
  }
  const live = await request('/api/content/onion?kind=project&locale=zh')
  assert.equal(live.coverId, coverId)
  if (!coverOnly) assert.deepEqual(live.metadata.projectScreenshots, screenshots)
  for (const mediaId of new Set([coverId, ...screenshots.map((entry) => entry.mediaId)])) {
    const response = await fetch(`${base}/api/media/${mediaId}`)
    assert.equal(response.status, 200, `Public media: ${mediaId}`)
    await response.arrayBuffer()
  }
  await writeFile(
    '.runtime/onion-project/screenshots-result.json',
    JSON.stringify({ id: item.id, coverId, screenshots: live.metadata.projectScreenshots }, null, 2),
  )
  console.log(
    JSON.stringify({
      title: live.title,
      coverUpdated: true,
      screenshots: live.metadata.projectScreenshots.length,
      url: `${base}/zh/projects/onion`,
    }),
  )
} finally {
  await request('/api/auth/logout', 'POST')
}
