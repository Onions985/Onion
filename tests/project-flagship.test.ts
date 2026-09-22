import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
const base = process.env.TEST_BASE_URL

test(
  'section pins apply across languages; replacements, drafts, screenshots and permissions remain correct',
  { skip: !base },
  async () => {
    const cookies = new Map<string, string>(),
      ids: string[] = []
    const scope = `pin-${randomUUID()}`
    async function request(path: string, method = 'GET', body?: any, status = 200, auth = true) {
      const response = await fetch(base + path, {
        method,
        headers: {
          ...(auth ? { cookie: [...cookies].map(([k, v]) => `${k}=${v}`).join('; ') } : {}),
          'x-onion-request': '1',
          ...(body && !(body instanceof FormData) ? { 'content-type': 'application/json' } : {}),
        },
        body: body ? (body instanceof FormData ? body : JSON.stringify(body)) : undefined,
      })
      if (auth)
        for (const raw of response.headers.getSetCookie()) {
          const [pair] = raw.split(';'),
            index = pair!.indexOf('=')
          cookies.set(pair!.slice(0, index), pair!.slice(index + 1))
        }
      const data = await response.json()
      assert.equal(response.status, status, `${method} ${path}: ${data.statusMessage || ''}`)
      return data
    }
    await request('/api/auth/login', 'POST', {
      email: process.env.ADMIN_EMAIL,
      password: process.env.ADMIN_PASSWORD,
    })
    try {
      for (const kind of ['blog', 'project', 'life']) {
        const pair: string[] = []
        for (const suffix of ['older', 'newer', 'draft']) {
          const slug = `${scope}-${kind}-${suffix}`
          const item = await request('/api/admin/content', 'POST', {
            kind,
            locale: 'zh',
            slug,
            title: slug,
            markdown: slug,
            metadata: { tags: [scope], ...(kind === 'life' ? { moment: { text: slug, imageIds: [] } } : {}) },
            expectedVersion: 0,
          })
          ids.push(item.id)
          if (suffix === 'draft') {
            await request(`/api/admin/content/${item.id}/pin`, 'PUT', { pinned: true }, 422)
            continue
          }
          pair.push(item.id)
          await request(`/api/admin/content/${item.id}/publish`, 'POST', { locale: 'zh', expectedVersion: 1 })
          if (kind === 'blog') {
            await request(`/api/admin/content/${item.id}/draft`, 'PUT', {
              locale: 'en',
              slug: `${slug}-en`,
              title: `${slug} English`,
              markdown: slug,
              metadata: { tags: [scope] },
              expectedVersion: 0,
            })
            await request(`/api/admin/content/${item.id}/publish`, 'POST', {
              locale: 'en',
              expectedVersion: 1,
            })
          }
        }
        await request(`/api/admin/content/${pair[0]}/pin`, 'PUT', { pinned: true }, 401, false)
        await request(`/api/admin/content/${pair[0]}/pin`, 'PUT', { pinned: 'yes' }, 422)
        assert.equal(
          (await request(`/api/admin/content/${pair[0]}/pin`, 'PUT', { pinned: true })).pinned,
          true,
        )
        if (kind === 'project') {
          const featured = await request(`/api/content?kind=project&featured=true&q=${scope}`)
          assert.equal(featured.items[0].id, pair[0], 'a pinned project also appears on the homepage')
        }
        for (const locale of ['zh', 'en']) {
          const list = await request(`/api/content?kind=${kind}&locale=${locale}&q=${scope}`)
          assert.deepEqual(
            list.items.map((item: any) => item.id),
            pair,
          )
          assert.equal(list.items[0].pinned, true)
          assert.equal(list.items[1].pinned, false)
          if (kind === 'blog') assert.equal(list.items[0].locale, locale)
          const tag = await request(`/api/content?kind=${kind}&locale=${locale}&tag=${scope}`)
          assert.equal(tag.items[0].id, pair[0])
          const search = await request(`/api/search?kind=${kind}&locale=${locale}&q=${scope}`)
          assert.equal(search.items[0].id, pair[0])
        }
        const original = await request(`/api/admin/content/${pair[0]}`),
          draft = original.translations.zh
        await request(`/api/admin/content/${pair[0]}/draft`, 'PUT', {
          ...draft,
          title: 'Unpublished edit',
          expectedVersion: draft.version,
        })
        const stillPublic = await request(`/api/content?kind=${kind}&q=${scope}`)
        assert.equal(stillPublic.items[0].id, pair[0])
        assert.notEqual(stillPublic.items[0].title, 'Unpublished edit')
        await request(`/api/admin/content/${pair[1]}/pin`, 'PUT', { pinned: true })
        assert.equal((await request(`/api/admin/content/${pair[0]}`)).pinned, false)
        const replaced = await request(`/api/content?kind=${kind}&q=${scope}`)
        assert.equal(replaced.items[0].id, pair[1])
        await request(`/api/admin/content/${pair[0]}/pin`, 'PUT', { pinned: false })
        assert.equal(
          (await request(`/api/admin/content/${pair[1]}`)).pinned,
          true,
          'stale unpin cannot remove newer pin',
        )
        await request(`/api/admin/content/${pair[1]}/pin`, 'PUT', { pinned: false })
        assert.equal((await request(`/api/admin/content/${pair[1]}`)).pinned, false)
      }
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
        'project-screen.png',
      )
      const image = await request('/api/admin/media', 'POST', form)
      const projectBody = {
        kind: 'project',
        locale: 'zh',
        slug: `${scope}-screenshots`,
        title: scope,
        markdown: 'Overview',
        metadata: {
          flagship: true,
          projectModules: [
            { title: 'World', description: 'Build a world', features: ['Remember interactions'] },
          ],
          projectScreenshots: [{ mediaId: image.id, caption: 'Actual screenshot' }],
        },
        expectedVersion: 0,
      }
      await request(
        '/api/admin/content',
        'POST',
        { ...projectBody, metadata: { projectScreenshots: [{ mediaId: randomUUID(), caption: '' }] } },
        422,
      )
      const project = await request('/api/admin/content', 'POST', projectBody)
      ids.push(project.id)
      assert.equal((await fetch(base + image.url)).status, 404, 'draft screenshot remains private')
      await request(`/api/admin/content/${project.id}/publish`, 'POST', { locale: 'zh', expectedVersion: 1 })
      const detail = await request(`/api/content/${scope}-screenshots?kind=project`)
      assert.equal(detail.metadata.projectModules[0].features[0], 'Remember interactions')
      assert.equal(detail.metadata.projectScreenshots[0].mediaId, image.id)
      const moduleSearch = await request('/api/search?kind=project&q=Remember%20interactions')
      assert(
        moduleSearch.items.some((item: any) => item.id === project.id),
        'module descriptions participate in project search',
      )
      assert.equal((await fetch(base + image.url)).status, 200, 'published screenshot is accessible')
      await request(`/api/admin/content/${project.id}`, 'DELETE')
      assert.equal((await fetch(base + image.url)).status, 404, 'archived screenshot is private again')
      ids.splice(ids.indexOf(project.id), 1)
    } finally {
      for (const id of ids) await request(`/api/admin/content/${id}`, 'DELETE')
      await request('/api/auth/logout', 'POST')
    }
  },
)
