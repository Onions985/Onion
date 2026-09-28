import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'

const base = process.env.TEST_BASE_URL
test(
  'admin comments: search across pages, author and title filters, moderation page recovery',
  { skip: !base },
  async () => {
    const cookies = new Map<string, string>(),
      scope = `comments-${randomUUID().slice(0, 12)}`
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
      const data = response.headers.get('content-type')?.includes('application/json')
        ? await response.json()
        : await response.text()
      assert.equal(response.status, expected, `${method} ${path}: ${data.statusMessage || ''}`)
      return data
    }
    const list = (extra = '') => request(`/api/admin/comments?q=${scope}${extra}`)
    await request('/api/admin/comments?q=test', 'GET', undefined, 401, false)
    await request('/api/auth/login', 'POST', {
      email: process.env.ADMIN_EMAIL,
      password: process.env.ADMIN_PASSWORD,
    })
    const body = {
      kind: 'blog',
      locale: 'zh',
      slug: scope,
      title: `${scope}-source`,
      markdown: 'Test article',
      metadata: {},
      expectedVersion: 0,
    }
    const item = await request('/api/admin/content', 'POST', body)
    let archived = false
    try {
      await request(`/api/admin/content/${item.id}/publish`, 'POST', { locale: 'zh', expectedVersion: 1 })
      await request(`/api/admin/content/${item.id}/draft`, 'PUT', {
        ...body,
        locale: 'en',
        title: `${scope}-english-source`,
      })
      const ids: string[] = []
      for (let i = 0; i < 31; i++) {
        const comment = await request('/api/comments', 'POST', {
          contentId: item.id,
          authorName: 'Test author',
          body: `${scope}-body-${i}`,
        })
        ids.push(comment.id)
      }
      const first = await list('&status=approved'),
        second = await list('&status=approved&page=2')
      assert.equal(first.pageSize, 30)
      assert.equal(first.total, 31)
      assert.equal(first.items.length, 30)
      assert.equal(second.page, 2)
      assert.equal(second.items.length, 1)
      assert.equal(new Set([...first.items, ...second.items].map((comment) => comment.id)).size, 31)
      assert.deepEqual(
        (await list('&status=approved')).items.map((comment) => comment.id),
        first.items.map((comment) => comment.id),
      )
      for (const suffix of ['body', 'source', 'english-source']) {
        assert.equal((await request(`/api/admin/comments?q=${scope}-${suffix}`)).total, 31)
      }
      const byName = await request(`/api/admin/comments?q=${encodeURIComponent(first.items[0].authorName)}`)
      assert(
        byName.items.some((comment) => ids.includes(comment.id)),
        'Nickname search includes authored comments',
      )
      assert.equal((await list('&status=pending')).total, 0)
      assert.equal((await request(`/api/admin/comments?q=${scope}%25`)).total, 0)
      assert.equal((await request(`/api/admin/comments?q=${scope}_missing`)).total, 0)
      assert.equal((await list('&page=-1')).page, 1)
      assert.equal((await list('&page=invalid')).page, 1)
      assert.equal((await list('&page=9999')).page, 2)
      assert.equal((await request(`/api/admin/comments?q=%20${scope}%20`)).total, 31)
      const html = await request(`/admin/comments?q=${scope}&status=approved&page=2`)
      assert.match(html, /搜索评论内容、昵称或文章标题/)
      assert.match(html, /共 31 条评论/)
      assert.match(html, /2 \/ 2/)
      const last = second.items[0]
      await request(`/api/admin/comments/${last.id}`, 'PUT', { status: 'hidden' })
      const recovered = await list('&status=approved&page=2')
      assert.equal(recovered.total, 30)
      assert.equal(recovered.page, 1)
      assert.equal(recovered.items.length, 30)
      assert(!recovered.items.some((comment) => comment.id === last.id))
      assert.equal((await list('&status=hidden')).items[0].id, last.id)
      assert.equal((await list('&status=')).total, 31)
      await request(`/api/admin/comments/${last.id}`, 'PUT', { status: 'pending' })
      assert.equal((await list('&status=pending')).total, 1)
      await request(`/api/admin/content/${item.id}`, 'DELETE')
      archived = true
      const empty = await list('&page=2')
      assert.equal(empty.total, 0)
      assert.equal(empty.page, 1)
      assert.equal(empty.items.length, 0)
    } finally {
      if (!archived) await request(`/api/admin/content/${item.id}`, 'DELETE')
      await request('/api/auth/logout', 'POST')
    }
  },
)
