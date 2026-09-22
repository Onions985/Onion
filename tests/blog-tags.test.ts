import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'

const base = process.env.TEST_BASE_URL

test(
  'blog tags: published-only facets, locale fallback, pagination, and author settings',
  { skip: !base },
  async () => {
    const cookies = new Map<string, string>()
    async function request(path: string, method = 'GET', body?: unknown, author = false) {
      const response = await fetch(`${base}${path}`, {
        method,
        headers: {
          ...(author ? { cookie: [...cookies].map(([k, v]) => `${k}=${v}`).join('; ') } : {}),
          ...(method !== 'GET' ? { 'x-onion-request': '1', 'Content-Type': 'application/json' } : {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      })
      if (author)
        for (const raw of response.headers.getSetCookie()) {
          const pair = raw.split(';')[0]!,
            index = pair.indexOf('=')
          cookies.set(pair.slice(0, index), pair.slice(index + 1))
        }
      assert.equal(response.status, 200, `${method} ${path}`)
      return response.json()
    }
    await request(
      '/api/auth/login',
      'POST',
      { email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD },
      true,
    )
    const suffix = randomUUID().slice(0, 8),
      topic = `topic-${suffix}`,
      draftTopic = `draft-${suffix}`,
      enTopic = `english-${suffix}`,
      customTopic = `C++ / 实战-${suffix}`
    const ids: string[] = []
    const settings = await request('/api/admin/site', 'GET', undefined, true)
    const article = (index: number) => ({
      kind: 'blog',
      locale: 'zh',
      slug: `tag-test-${suffix}-${index}`,
      title: `Tag test ${index}`,
      summary: '',
      markdown: '## Tag integration test',
      metadata: { tags: [topic, 'android', 'Android', customTopic] },
      expectedVersion: 0,
    })
    const facets = (locale = 'zh') => request(`/api/blog-tags?locale=${locale}`)
    const filtered = (tag: string, page = 1, locale = 'zh') =>
      request(`/api/content?kind=blog&locale=${locale}&tag=${encodeURIComponent(tag)}&page=${page}`)
    const count = (catalog: any, tag: string) =>
      catalog.tags.find((entry: any) => entry.name === tag)?.count || 0
    try {
      for (let i = 0; i < 13; i++) {
        const created = await request('/api/admin/content', 'POST', article(i), true)
        ids.push(created.id)
        assert.deepEqual(created.translations.zh.metadata.tags, [topic, 'Android', customTopic])
        if (i === 0) assert.equal(count(await facets(), topic), 0, 'draft labels remain private')
        await request(
          `/api/admin/content/${created.id}/publish`,
          'POST',
          { locale: 'zh', expectedVersion: 1 },
          true,
        )
      }
      const catalog = await facets()
      assert.equal(count(catalog, topic), 13)
      const first = await filtered(topic),
        second = await filtered(topic, 2)
      assert.equal(first.total, 13)
      assert.equal(first.items.length, 12)
      assert.equal(second.total, 13)
      assert.equal(second.items.length, 1)
      assert.equal(new Set([...first.items, ...second.items].map((item: any) => item.id)).size, 13)
      const page = await fetch(`${base}/zh/tags/${topic}?page=2`)
      const html = await page.text()
      assert.equal(page.status, 200)
      assert.ok(html.includes(second.items[0].title), 'page two keeps its first article')
      assert.match(html, new RegExp(`/zh/tags/${topic}\\?page=1`))
      const taggedPage = await fetch(`${base}/zh/tags/${encodeURIComponent(customTopic)}`)
      const taggedHtml = await taggedPage.text()
      assert.equal(taggedPage.status, 200)
      assert.ok(taggedHtml.includes(customTopic), 'custom tag heading is rendered')
      assert.ok(taggedHtml.includes(first.items[0].title))
      assert.ok(
        taggedHtml.includes(`/zh/tags/${encodeURIComponent(customTopic)}`),
        'article labels link to their own tag page',
      )
      const detailHtml = await (await fetch(`${base}/zh/posts/${first.items[0].slug}`)).text()
      assert.ok(detailHtml.includes(`/zh/tags/${topic}`), 'detail tags link to the tag page')
      const legacyPage = await fetch(`${base}/zh/writing?tag=${topic}&page=2`)
      assert.equal(legacyPage.status, 200, 'existing bookmarked tag filters still work')
      assert.equal((await filtered(`absent-${suffix}`)).total, 0)
      assert.equal((await filtered(`x' OR 1=1 --`)).total, 0)
      assert.equal((await filtered(topic, 1, 'en')).total, 13)
      assert.equal(count(await facets('en'), topic), 13)

      const changed = await request(
        `/api/admin/content/${ids[0]}/draft`,
        'PUT',
        {
          ...article(0),
          metadata: { tags: [draftTopic] },
          expectedVersion: 2,
        },
        true,
      )
      assert.equal(count(await facets(), draftTopic), 0)
      assert.equal((await filtered(topic)).total, 13, 'draft edits leave published tags intact')
      await request(
        `/api/admin/content/${ids[0]}/draft`,
        'PUT',
        {
          ...article(0),
          locale: 'en',
          metadata: { tags: [enTopic] },
          expectedVersion: 0,
        },
        true,
      )
      await request(
        `/api/admin/content/${ids[0]}/publish`,
        'POST',
        { locale: 'en', expectedVersion: 1 },
        true,
      )
      assert.equal(count(await facets('en'), enTopic), 1)
      assert.equal(count(await facets('en'), topic), 12)
      assert.equal((await filtered(topic, 1, 'en')).total, 12)
      assert.equal((await filtered(enTopic, 1, 'zh')).total, 0)
      assert.equal((await filtered(topic)).total, 13)
      await request(
        `/api/admin/content/${ids[0]}/publish`,
        'POST',
        { locale: 'zh', expectedVersion: changed.translations.zh.version },
        true,
      )
      assert.equal((await filtered(topic)).total, 12)
      assert.equal(count(await facets(), draftTopic), 1)
      await request(
        `/api/admin/content/${ids[1]}/unpublish`,
        'POST',
        { locale: 'zh', expectedVersion: 2 },
        true,
      )
      assert.equal(count(await facets(), topic), 11)

      const project = await request('/api/admin/content', 'POST', { ...article(99), kind: 'project' }, true)
      ids.push(project.id)
      await request(
        `/api/admin/content/${project.id}/publish`,
        'POST',
        { locale: 'zh', expectedVersion: 1 },
        true,
      )
      assert.equal(count(await facets(), topic), 11, 'project tags do not enter blog navigation')
      await request(
        '/api/admin/site',
        'PUT',
        {
          ...settings,
          config: { ...settings.config, writingTags: [...settings.config.writingTags, `empty-${suffix}`] },
        },
        true,
      )
      assert.ok(
        (await facets()).tags.some((entry: any) => entry.name === `empty-${suffix}` && entry.count === 0),
      )
      for (const id of ids) await request(`/api/admin/content/${id}`, 'DELETE', undefined, true)
      assert.equal(count(await facets(), topic), 0, 'archived articles leave the catalog')
    } finally {
      // All fixtures live in onion_test; archiving keeps the same lifecycle as the author UI.
      await request('/api/admin/site', 'PUT', settings, true)
      for (const id of ids) {
        await fetch(`${base}/api/admin/content/${id}`, {
          method: 'DELETE',
          headers: { cookie: [...cookies].map(([k, v]) => `${k}=${v}`).join('; '), 'x-onion-request': '1' },
        })
      }
    }
  },
)
