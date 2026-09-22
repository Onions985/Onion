import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'

const base = process.env.TEST_BASE_URL
test(
  'moment lifecycle: nine photos, image access, cover order, plain text, draft isolation and author permissions',
  { skip: !base },
  async () => {
    const cookies = new Map<string, string>(),
      created: string[] = []
    async function request(path: string, method = 'GET', body?: any, auth = true) {
      const response = await fetch(base + path, {
        method,
        headers: {
          ...(auth ? { cookie: [...cookies].map(([k, v]) => `${k}=${v}`).join('; ') } : {}),
          ...(method !== 'GET' ? { 'x-onion-request': '1' } : {}),
          ...(body && !(body instanceof FormData) ? { 'content-type': 'application/json' } : {}),
        },
        body: body ? (body instanceof FormData ? body : JSON.stringify(body)) : undefined,
      })
      if (auth)
        for (const raw of response.headers.getSetCookie()) {
          const [pair] = raw.split(';'),
            i = pair!.indexOf('=')
          cookies.set(pair!.slice(0, i), pair!.slice(i + 1))
        }
      const data = await response.json().catch(() => null)
      return { status: response.status, data }
    }
    assert.equal(
      (
        await request('/api/auth/login', 'POST', {
          email: process.env.ADMIN_EMAIL,
          password: process.env.ADMIN_PASSWORD,
        })
      ).status,
      200,
    )
    try {
      const images: string[] = []
      for (let i = 0; i < 10; i++) {
        const form = new FormData()
        form.append(
          'file',
          new Blob(
            [
              Buffer.from(
                'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a3gAAAABJRU5ErkJggg==',
                'base64',
              ),
            ],
            { type: 'image/png' },
          ),
          `moment-${i}.png`,
        )
        const asset = await request('/api/admin/media', 'POST', form)
        assert.equal(asset.status, 200)
        images.push(asset.data.id)
      }
      const slug = `moment-test-${randomUUID()}`
      const body = {
        kind: 'life',
        locale: 'zh',
        slug,
        title: 'unused title',
        summary: '',
        markdown: '',
        coverId: images[9],
        expectedVersion: 0,
        metadata: { moment: { text: '', imageIds: images.slice(0, 9) } },
      }
      assert.equal((await request('/api/admin/content', 'POST', body, false)).status, 401)
      const tooMany = await request('/api/admin/content', 'POST', {
        ...body,
        metadata: { moment: { text: '', imageIds: images } },
      })
      assert.equal(tooMany.status, 422)
      assert.equal(
        (
          await request('/api/admin/content', 'POST', {
            ...body,
            metadata: { moment: { text: '', imageIds: [randomUUID()] } },
          })
        ).status,
        422,
      )
      const made = await request('/api/admin/content', 'POST', body)
      assert.equal(made.status, 200)
      const id = made.data.id
      created.push(id)
      assert.equal(made.data.translations.zh.coverId, images[0])
      assert.equal((await fetch(`${base}/api/media/${images[8]}`)).status, 404)
      assert.equal(
        (
          await request(
            `/api/admin/content/${id}/publish`,
            'POST',
            { locale: 'zh', expectedVersion: 1 },
            false,
          )
        ).status,
        401,
      )
      assert.equal(
        (await request(`/api/admin/content/${id}/publish`, 'POST', { locale: 'zh', expectedVersion: 1 }))
          .status,
        200,
      )
      const get = async () =>
        (await request(`/api/content/${slug}?kind=life&locale=en`, 'GET', undefined, false)).data
      assert.deepEqual((await get()).metadata.moment.imageIds, images.slice(0, 9))
      assert.equal((await get()).locale, 'zh')
      for (const id of images.slice(0, 9)) assert.equal((await fetch(`${base}/api/media/${id}`)).status, 200)
      assert.equal((await fetch(`${base}/api/media/${images[9]}`)).status, 404)
      const reordered = [images[9], ...images.slice(0, 8).reverse()]
      const changed = {
        ...body,
        expectedVersion: 2,
        metadata: { moment: { text: '这一刻\n<script>alert(1)</script> **hello**', imageIds: reordered } },
      }
      const saved = await request(`/api/admin/content/${id}/draft`, 'PUT', changed)
      assert.equal(saved.status, 200)
      assert.equal(saved.data.translations.zh.coverId, images[9])
      assert.equal((await request(`/api/admin/content/${id}/draft`, 'PUT', changed)).status, 409)
      assert.equal((await get()).coverId, images[0])
      assert.equal((await fetch(`${base}/api/media/${images[9]}`)).status, 404)
      assert.equal(
        (await request(`/api/admin/content/${id}/publish`, 'POST', { locale: 'zh', expectedVersion: 3 }))
          .status,
        200,
      )
      const published = await get()
      assert.equal(published.coverId, images[9])
      assert.deepEqual(published.metadata.moment.imageIds, reordered)
      assert.doesNotMatch(published.html, /<script|<strong>/)
      assert.equal((await fetch(`${base}/api/media/${images[8]}`)).status, 404)
      const page = await (await fetch(`${base}/zh/life/${slug}`)).text()
      assert.match(page, /moment-gallery/)
      assert.match(page, /&lt;script&gt;/)
    assert.doesNotMatch(page.slice(page.indexOf('<body>')), /<script>alert\(1\)<\/script>/)
      const guest = await request(
        '/api/comments',
        'POST',
        { contentId: id, authorName: '读者', body: '照片不错' },
        false,
      )
      assert.equal(guest.status, 200)
      assert.equal(guest.data.status, 'pending')
      const textOnly = await request(`/api/admin/content/${id}/draft`, 'PUT', {
        ...body,
        expectedVersion: 4,
        metadata: { moment: { text: '纯文字也能记录', imageIds: [] } },
      })
      assert.equal(textOnly.status, 200)
      assert.equal(textOnly.data.translations.zh.coverId, null)
      assert.equal(
        (await request(`/api/admin/content/${id}/publish`, 'POST', { locale: 'zh', expectedVersion: 5 }))
          .status,
        200,
      )
      assert.equal((await fetch(`${base}/api/media/${images[0]}`)).status, 404)
      assert.equal(
        (
          await request(`/api/admin/content/${id}/draft`, 'PUT', {
            ...body,
            expectedVersion: 6,
            metadata: { moment: { text: '  ', imageIds: [] } },
          })
        ).status,
        200,
      )
      const empty = await request(`/api/admin/content/${id}/publish`, 'POST', {
        locale: 'zh',
        expectedVersion: 7,
      })
      assert.equal(empty.status, 422)
      assert.equal(empty.data.statusMessage, 'EMPTY_MOMENT')
      assert.equal((await get()).metadata.moment.text, '纯文字也能记录')
    } finally {
      for (const id of created) await request(`/api/admin/content/${id}`, 'DELETE')
      await request('/api/auth/logout', 'POST')
    }
  },
)
