import assert from 'node:assert/strict'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
const dbUrl = new URL(process.env.DATABASE_URL)
assert(dbUrl.hostname === '127.0.0.1' && dbUrl.port === '3317' && dbUrl.pathname === '/onion')
const base = 'http://127.0.0.1:3000', cookies = new Map()
async function request(path, method = 'GET', body) {
  const response = await fetch(base + path, {
    method, headers: { cookie: [...cookies].map(([k,v]) => `${k}=${v}`).join('; '),
      ...(method !== 'GET' ? { 'x-onion-request': '1' } : {}),
      ...(body && !(body instanceof FormData) ? { 'content-type': 'application/json' } : {}) },
    body: body ? body instanceof FormData ? body : JSON.stringify(body) : undefined,
  })
  for (const raw of response.headers.getSetCookie()) { const [pair] = raw.split(';'), i = pair.indexOf('='); cookies.set(pair.slice(0, i), pair.slice(i + 1)) }
  const data = await response.json()
  assert(response.ok, `${method} ${path}: ${response.status} ${data.statusMessage || ''}`)
  return data
}
await request('/api/auth/login', 'POST', { email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD })
try {
  const { items } = await request('/api/admin/content')
  const selected = ['opc-devops', 'talking-rounds', 'tanxiaoer'].map(slug => {
    const item = items.find(i => i.kind === 'project' && i.translations.zh?.slug === slug)
    assert(item, `Missing project: ${slug}`)
    assert.equal(item.translations.zh.draftRevisionId, item.translations.zh.publishedRevisionId, `Unpublished edits preserved: ${slug}`)
    return item
  })
  await mkdir('.runtime/project-covers', { recursive: true })
  await writeFile(`.runtime/project-covers/before-${Date.now()}.json`, JSON.stringify(selected, null, 2))
  const result = []
  for (const item of selected) {
    const draft = item.translations.zh, form = new FormData()
    form.append('file', new Blob([await readFile(`docs/projects/covers/${draft.slug}.png`)], { type: 'image/png' }), `${draft.slug}-cover.png`)
    const asset = await request('/api/admin/media', 'POST', form)
    const saved = await request(`/api/admin/content/${item.id}/draft`, 'PUT', { ...draft, coverId: asset.id, expectedVersion: draft.version })
    await request(`/api/admin/content/${item.id}/publish`, 'POST', { locale: 'zh', expectedVersion: saved.translations.zh.version })
    const published = await (await fetch(`${base}/api/content/${draft.slug}?kind=project&locale=zh`)).json()
    assert.equal(published.coverId, asset.id)
    assert.equal((await fetch(base + asset.url)).status, 200)
    result.push({ slug: draft.slug, coverId: asset.id, file: `docs/projects/covers/${draft.slug}.png` })
  }
  await writeFile('.runtime/project-covers/result.json', JSON.stringify(result, null, 2))
  console.log(JSON.stringify(result))
} finally { await request('/api/auth/logout', 'POST') }
