import assert from 'node:assert/strict'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { draftSchema } from '../shared/validation.ts'

const dbUrl = new URL(process.env.DATABASE_URL)
assert(
  dbUrl.hostname === '127.0.0.1' && dbUrl.port === '3317' && dbUrl.pathname === '/onion',
  'Local Onion database only',
)
const base = process.env.PROJECT_PUBLISH_BASE || 'http://127.0.0.1:3000'
assert(['http://127.0.0.1:3000', 'http://127.0.0.1:3002'].includes(base))
const project = JSON.parse(await readFile('docs/projects/picagent.json', 'utf8'))
const markdown = await readFile('docs/projects/picagent.md', 'utf8')
const draft = draftSchema.parse({ ...project, markdown, locale: 'zh', expectedVersion: 0 })
const sources = await Promise.all(
  project.sources.map(async (path) => {
    assert(!/readme/i.test(path), 'Read only code as requested')
    return {
      path,
      sha256: createHash('sha256')
        .update(await readFile(path))
        .digest('hex'),
    }
  }),
)
await writeFile(
  'docs/projects/picagent-source-evidence.json',
  JSON.stringify({ inspectedAt: new Date().toISOString(), sources }, null, 2),
)
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
    const [pair] = raw.split(';'),
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
  const { items } = await request('/api/admin/content')
  const existing = items.find((item) => item.kind === 'project' && item.translations.zh?.slug === 'picagent')
  if (existing) {
    const current = existing.translations.zh
    assert(
      current.markdown === markdown &&
        current.metadata.flagship &&
        current.publishedRevisionId === current.draftRevisionId,
      'Existing PicAgent edits preserved',
    )
    await request(`/api/admin/content/${existing.id}/pin`, 'PUT', { pinned: true })
    console.log('PicAgent is already published and pinned.')
  } else {
    await mkdir('.runtime/picagent-project', { recursive: true })
    await writeFile(
      `.runtime/picagent-project/before-${Date.now()}.json`,
      JSON.stringify(
        items.filter((item) => item.kind === 'project'),
        null,
        2,
      ),
    )
    const form = new FormData()
    form.append(
      'file',
      new Blob([await readFile('docs/projects/covers/picagent.png')], { type: 'image/png' }),
      'picagent-cover.png',
    )
    const asset = await request('/api/admin/media', 'POST', form)
    const created = await request('/api/admin/content', 'POST', {
      ...draft,
      kind: 'project',
      coverId: asset.id,
    })
    await writeFile(
      '.runtime/picagent-project/created.json',
      JSON.stringify({ id: created.id, coverId: asset.id }, null, 2),
    )
    const published = await request(`/api/admin/content/${created.id}/publish`, 'POST', {
      locale: 'zh',
      expectedVersion: created.translations.zh.version,
    })
    assert.equal(published.translations.zh.metadata.flagship, true)
    await request(`/api/admin/content/${created.id}/pin`, 'PUT', { pinned: true })
    const live = await request('/api/content/picagent?kind=project&locale=zh')
    assert(
      live.coverId === asset.id &&
        live.metadata.flagship &&
        live.pinned &&
        live.metadata.projectModules.length === 13 &&
        live.html.includes('智能体世界'),
    )
    assert.equal((await fetch(base + asset.url)).status, 200)
    await writeFile(
      '.runtime/picagent-project/result.json',
      JSON.stringify(
        { id: created.id, coverId: asset.id, slug: live.slug, url: `${base}/zh/projects/picagent` },
        null,
        2,
      ),
    )
    console.log(
      JSON.stringify({ published: live.title, coverId: asset.id, flagship: live.metadata.flagship }),
    )
  }
} finally {
  await request('/api/auth/logout', 'POST')
}
