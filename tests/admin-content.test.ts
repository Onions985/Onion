import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'

const base = process.env.TEST_BASE_URL
test(
  'admin content: server pagination, draft search, filters and archive page recovery',
  { skip: !base },
  async () => {
    const cookies = new Map<string, string>(),
      ids: string[] = []
    const scope = `paging-${randomUUID().slice(0, 12)}`
    async function request(path: string, method = 'GET', body?: unknown, expected = 200, auth = true) {
      const response = await fetch(base + path, {
        method,
        headers: {
          ...(auth ? { cookie: [...cookies].map(([k, v]) => `${k}=${v}`).join('; ') } : {}),
          'x-onion-request': '1',
          ...(body ? { 'content-type': 'application/json' } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      })
      if (auth)
        for (const raw of response.headers.getSetCookie()) {
          const pair = raw.split(';')[0]!,
            index = pair.indexOf('=')
          cookies.set(pair.slice(0, index), pair.slice(index + 1))
        }
      const data = await response.json()
      assert.equal(response.status, expected, `${method} ${path}: ${data.statusMessage || ''}`)
      return data
    }
    const list = (extra = '') => request(`/api/admin/content?q=${scope}${extra}`)
    await request('/api/admin/content?page=2', 'GET', undefined, 401, false)
    await request('/api/auth/login', 'POST', {
      email: process.env.ADMIN_EMAIL,
      password: process.env.ADMIN_PASSWORD,
    })
    try {
      assert.equal((await list()).total, 0)
      for (let i = 0; i < 23; i++) {
        const kind = i < 21 ? 'blog' : i === 21 ? 'project' : 'life'
        const body = {
          kind,
          locale: 'zh',
          slug: `${scope}-${i}`,
          title: `${scope} ${i}`,
          markdown: i === 0 ? `${scope}-body` : 'draft',
          metadata: { tags: i === 1 ? [`${scope}-tag`] : [] },
          expectedVersion: 0,
        }
        const item = await request('/api/admin/content', 'POST', body)
        ids.push(item.id)
        if (i === 0)
          await request(`/api/admin/content/${item.id}/draft`, 'PUT', {
            ...body,
            locale: 'en',
            title: `${scope} English`,
            markdown: `${scope}-english`,
            expectedVersion: 0,
          })
      }
      const first = await list(),
        second = await list('&page=2')
      assert.equal(first.pageSize, 20)
      assert.equal(first.total, 23)
      assert.equal(first.items.length, 20)
      assert.equal(second.items.length, 3)
      assert.equal(new Set([...first.items, ...second.items].map((item) => item.id)).size, 23)
      assert.deepEqual(
        (await list()).items.map((item) => item.id),
        first.items.map((item) => item.id),
      )
      assert.equal(
        first.items[0].translations.zh.markdown,
        undefined,
        'List must not send full article bodies',
      )
      const blogs = await list('&kind=blog&page=2')
      assert.equal(blogs.total, 21)
      assert.equal(blogs.items.length, 1)
      assert.equal(blogs.items[0].kind, 'blog')
      for (const suffix of ['body', 'tag', 'english']) {
        const result = await request(`/api/admin/content?q=${scope}-${suffix}`)
        assert.equal(result.total, 1, `Search draft ${suffix}`)
      }
      assert.equal((await request(`/api/admin/content?q=${scope}-body&kind=project`)).total, 0)
      assert.equal(
        (await request(`/api/admin/content?q=${scope}%25`)).total,
        0,
        'Percent is literal, not a wildcard',
      )
      assert.equal((await list('&page=-2')).page, 1)
      assert.equal((await list('&page=invalid')).page, 1)
      assert.equal((await list('&page=9999')).page, 2)
      const bilingual = [...first.items, ...second.items].find((item) => item.id === ids[0])
      assert.equal(Object.keys(bilingual.translations).length, 2)
      await request(`/api/admin/content/${blogs.items[0].id}`, 'DELETE')
      const recovered = await list('&kind=blog&page=2')
      assert.equal(recovered.total, 20)
      assert.equal(recovered.page, 1)
      assert.equal(recovered.items.length, 20)
      assert(!recovered.items.some((item) => item.id === blogs.items[0].id))
      ids.splice(ids.indexOf(blogs.items[0].id), 1)
    } finally {
      for (const id of ids) await request(`/api/admin/content/${id}`, 'DELETE')
      await request('/api/auth/logout', 'POST')
    }
  },
)
