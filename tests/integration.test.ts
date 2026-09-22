import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
const base = process.env.TEST_BASE_URL
test(
  'MySQL HTTP lifecycle: bilingual drafts, publishing, media, conflicts, preferences',
  { skip: !base },
  async () => {
    const cookies = new Map<string, string>()
    async function request(
      path: string,
      method = 'GET',
      body?: unknown,
      authenticated = true,
      headers: Record<string, string> = {},
    ) {
      const response = await fetch(`${base}${path}`, {
        method,
        headers: {
          ...(authenticated
            ? { cookie: [...cookies].map(([key, value]) => `${key}=${value}`).join('; ') }
            : {}),
          ...(method !== 'GET' ? { 'x-onion-request': '1' } : {}),
          ...(body && !(body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
          ...headers,
        },
        body: body ? (body instanceof FormData ? body : JSON.stringify(body)) : undefined,
      })
      if (authenticated)
        for (const raw of response.headers.getSetCookie()) {
          const [pair] = raw.split(';')
          const index = pair!.indexOf('=')
          cookies.set(pair!.slice(0, index), pair!.slice(index + 1))
        }
      let data: any
      try {
        data = await response.json()
      } catch {}
      return { status: response.status, data }
    }
    assert.equal((await request('/api/admin/content', 'GET', undefined, false)).status, 401)
    assert.equal((await request('/api/admin/content', 'POST', { kind: 'life' }, false)).status, 401)
    assert.equal((await request('/api/admin/site', 'PUT', {}, false)).status, 401)
    assert.equal(
      (
        await request('/api/preferences', 'PUT', { locale: 'zh', theme: 'dark' }, false, {
          'x-onion-request': '0',
        })
      ).status,
      403,
    )
    assert.equal(
      (
        await request('/api/auth/login', 'POST', {
          email: process.env.ADMIN_EMAIL,
          password: process.env.ADMIN_PASSWORD,
        })
      ).status,
      200,
    )
    const image = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a3gAAAABJRU5ErkJggg==',
        'base64',
      ),
      form = new FormData()
    form.append('file', new Blob([image], { type: 'image/png' }), 'test.png')
    const uploaded = await request('/api/admin/media', 'POST', form)
    assert.equal(uploaded.status, 200)
    const asset = uploaded.data
    assert.equal((await request(asset.url, 'GET', undefined, false)).status, 404)
    assert.equal(
      (
        await fetch(base + asset.url, {
          headers: { cookie: [...cookies].map(([k, v]) => `${k}=${v}`).join('; ') },
        })
      ).status,
      200,
    )
    const invalid = new FormData()
    invalid.append('file', new Blob(['<svg onload="alert(1)"></svg>'], { type: 'image/png' }), 'bad.png')
    assert.equal((await request('/api/admin/media', 'POST', invalid)).status, 415)
    const slug = `integration-${randomUUID()}`,
      body = {
        locale: 'zh',
        kind: 'blog',
        slug,
        title: '集成测试',
        summary: 'Database lifecycle test',
        markdown: `## 第一版\n\n**真实入库**\n\n![one](${asset.url})`,
        coverId: asset.id,
        metadata: { category: 'Test' },
        expectedVersion: 0,
      }
    const created = await request('/api/admin/content', 'POST', body)
    assert.equal(created.status, 200)
    const id = created.data.id
    try {
      assert.equal(
        (await request(`/api/content/${slug}?locale=zh&kind=blog`, 'GET', undefined, false)).status,
        404,
      )
      const publish = await request(`/api/admin/content/${id}/publish`, 'POST', {
        locale: 'zh',
        expectedVersion: 1,
      })
      assert.equal(publish.status, 200)
      const publicOne = await request(`/api/content/${slug}?locale=zh&kind=blog`, 'GET', undefined, false)
      assert.match(publicOne.data.html, /第一版/)
      const fallback = await request(`/api/content/${slug}?locale=en&kind=blog`, 'GET', undefined, false)
      assert.equal(fallback.status, 200)
      assert.equal(fallback.data.locale, 'zh')
      assert.equal(fallback.data.title, '集成测试')
      const englishList = await request(`/api/content?locale=en&kind=blog&q=${slug}`, 'GET', undefined, false)
      const fallbackList = await request(
        '/api/content?locale=en&kind=blog&q=集成测试',
        'GET',
        undefined,
        false,
      )
      assert.equal(fallbackList.data.items.length, 1)
      assert.equal(fallbackList.data.items[0].locale, 'zh')
      assert.equal((await fetch(base + asset.url)).status, 200)
      const guest = await request(
        '/api/comments',
        'POST',
        { contentId: id, authorName: '读者 <b>name</b>', body: '很喜欢这篇文章。 <script>alert(1)</script>' },
        false,
      )
      assert.equal(guest.status, 200)
      assert.equal(guest.data.status, 'pending')
      const commentId = guest.data.id
      assert.equal((await request(`/api/comments?contentId=${id}`, 'GET', undefined, false)).data.total, 0)
      assert.equal(
        (await request(`/api/admin/comments/${commentId}`, 'PUT', { status: 'approved' }, false)).status,
        401,
      )
      assert.equal(
        (await request(`/api/admin/comments/${commentId}`, 'PUT', { status: 'approved' })).status,
        200,
      )
      const approved = await request(`/api/comments?contentId=${id}`, 'GET', undefined, false)
      assert.equal(approved.data.total, 1)
      assert.equal(Boolean(approved.data.items[0].isAuthor), false)
      const reply = await request(`/api/admin/comments/${commentId}/reply`, 'POST', {
        body: '谢谢你的阅读！',
      })
      assert.equal(reply.status, 200)
      const withReply = await request(`/api/comments?contentId=${id}`, 'GET', undefined, false)
      assert.equal(withReply.data.items.length, 2)
      assert.equal(Boolean(withReply.data.items.find((c: any) => c.parentId === commentId).isAuthor), true)
      const rendered = await fetch(`${base}/zh/posts/${slug}`)
      const html = await rendered.text()
      assert.equal(rendered.status, 200)
      assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/)
      assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/)
      await request(`/api/admin/comments/${commentId}`, 'PUT', { status: 'hidden' })
      assert.equal(
        (await request(`/api/comments?contentId=${id}`, 'GET', undefined, false)).data.items.length,
        0,
      )
      const changed = {
        ...body,
        slug: `${slug}-renamed`,
        title: '未发布标题',
        markdown: '## 第二版',
        expectedVersion: 2,
      }
      const draft = await request(`/api/admin/content/${id}/draft`, 'PUT', changed)
      assert.equal(draft.status, 200)
      assert.equal((await request(`/api/admin/content/${id}/draft`, 'PUT', changed)).status, 409)
      assert.equal(
        (await request(`/api/content/${slug}?locale=zh&kind=blog`, 'GET', undefined, false)).data.title,
        '集成测试',
      )
      assert.equal(
        (await request(`/api/content/${slug}-renamed?locale=zh&kind=blog`, 'GET', undefined, false)).status,
        404,
      )
      const en = await request(`/api/admin/content/${id}/draft`, 'PUT', {
        ...body,
        locale: 'en',
        title: 'English edition',
        markdown: '## English content',
        expectedVersion: 0,
      })
      assert.equal(en.status, 200)
      assert.equal(
        (await request(`/api/admin/content/${id}/publish`, 'POST', { locale: 'en', expectedVersion: 1 }))
          .status,
        200,
      )
      const bilingual = await request(`/api/content/${slug}?locale=zh&kind=blog`, 'GET', undefined, false)
      assert.equal(bilingual.data.translations.length, 2)
      assert.equal(
        (await request(`/api/content/${slug}?locale=en&kind=blog`, 'GET', undefined, false)).data.title,
        'English edition',
      )
      assert.equal(
        (await request(`/api/admin/content/${id}/publish`, 'POST', { locale: 'zh', expectedVersion: 3 }))
          .status,
        200,
      )
      assert.equal(
        (await request(`/api/content/${slug}-renamed?locale=zh&kind=blog`, 'GET', undefined, false)).data
          .title,
        '未发布标题',
      )
      assert.equal(
        (await request(`/api/admin/content/${id}/unpublish`, 'POST', { locale: 'zh', expectedVersion: 4 }))
          .status,
        200,
      )
      assert.equal(
        (await request(`/api/content/${slug}-renamed?locale=zh&kind=blog`, 'GET', undefined, false)).status,
        404,
      )
      assert.equal((await request('/api/preferences', 'PUT', { locale: 'en', theme: 'dark' })).status, 200)
      const site = await request('/api/site?locale=en')
      assert.equal(site.data.preference.theme, 'dark')
      assert.equal(site.data.preference.locale, 'en')
      assert.equal(site.data.messages['nav.home'], 'Home')
      await request('/api/auth/logout', 'POST')
      assert.equal((await request('/api/admin/content')).status, 401)
    } finally {
      await request('/api/auth/login', 'POST', {
        email: process.env.ADMIN_EMAIL,
        password: process.env.ADMIN_PASSWORD,
      })
      await request(`/api/admin/content/${id}`, 'DELETE')
    }
  },
)
