import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'

const base = process.env.TEST_BASE_URL
test(
  'discovery: published selections, reading, series, feeds, settings, project stories and SEO',
  { skip: !base },
  async () => {
    const cookies = new Map<string, string>()
    async function request(path: string, method = 'GET', body?: unknown, expected = 200) {
      const multipart = body instanceof FormData
      const response = await fetch(base + path, {
        method,
        headers: {
          cookie: [...cookies].map(([key, value]) => `${key}=${value}`).join('; '),
          ...(method !== 'GET'
            ? { 'x-onion-request': '1', ...(multipart ? {} : { 'Content-Type': 'application/json' }) }
            : {}),
        },
        body: body === undefined ? undefined : multipart ? body : JSON.stringify(body),
      })
      for (const raw of response.headers.getSetCookie()) {
        const pair = raw.split(';')[0]!
        const separator = pair.indexOf('=')
        cookies.set(pair.slice(0, separator), pair.slice(separator + 1))
      }
      assert.equal(response.status, expected, `${method} ${path}`)
      return response.json()
    }
    const scope = `discovery-${randomUUID().slice(0, 8)}`
    await request('/api/auth/login', 'POST', {
      email: process.env.ADMIN_EMAIL,
      password: process.env.ADMIN_PASSWORD,
    })
    const settings = await request('/api/admin/site')
    const ids: string[] = []
    const body = (suffix: string, order: number) => ({
      kind: 'blog',
      locale: 'zh',
      slug: `${scope}-${suffix}`,
      title: `${scope} ${suffix}`,
      summary: 'A & B <notes>',
      markdown: '## First\n\nText.\n\n## Second\n\n```js\nconst answer = 42\n```',
      metadata: { tags: [scope], featured: true, series: { name: scope, order } },
      expectedVersion: 0,
    })
    try {
      const a = await request('/api/admin/content', 'POST', body('a', 1))
      ids.push(a.id)
      const b = await request('/api/admin/content', 'POST', body('b', 2))
      ids.push(b.id)
      const hidden = await request('/api/admin/content', 'POST', body('hidden', 3))
      ids.push(hidden.id)
      for (const item of [a, b])
        await request(`/api/admin/content/${item.id}/publish`, 'POST', { locale: 'zh', expectedVersion: 1 })
      const project = await request('/api/admin/content', 'POST', {
        ...body('project', 1),
        kind: 'project',
        metadata: {
          projectStory: {
            demoUrl: 'https://example.test/demo',
            decision: 'A real tradeoff',
            outcome: 'A verified milestone',
          },
        },
      })
      ids.push(project.id)
      await request(`/api/admin/content/${project.id}/publish`, 'POST', { locale: 'zh', expectedVersion: 1 })
      await request('/api/admin/site', 'PUT', {
        ...settings,
        config: {
          ...settings.config,
          startHere: { blogIds: [b.id, a.id], projectId: project.id },
          now: { zh: 'A real update', en: '', updatedOn: '2026-09-28' },
          socialLinks: [{ label: 'GitHub', url: 'https://github.com/example' }],
        },
      })
      const site = await request('/api/site?locale=en')
      assert.equal(site.config.now.zh, 'A real update')
      assert.equal(site.messages['reading.contents'], 'On this page')
      assert.equal(site.siteUrl, base)
      const choices = await request('/api/admin/published-content')
      assert(!choices.items.some((item: any) => item.id === hidden.id))
      const selections = await request('/api/selections?locale=en')
      assert.deepEqual(
        selections.items.map((item: any) => item.id),
        [b.id, a.id, project.id],
      )
      let detail = await request(`/api/content/${scope}-a?kind=blog&locale=en`)
      assert.equal(detail.locale, 'zh')
      assert.equal(detail.headings.length, 2)
      assert.equal(detail.seriesNavigation.next.id, b.id)
      assert.equal(detail.seriesNavigation.previous, null)
      assert.deepEqual(
        detail.related.map((item: any) => item.id),
        [b.id],
      )
      await request(`/api/admin/content/${a.id}/draft`, 'PUT', {
        ...body('secret-new-slug', 4),
        expectedVersion: 2,
        title: `${scope}-PRIVATE`,
      })
      detail = await request(`/api/content/${scope}-a?kind=blog`)
      assert.equal(detail.title, `${scope} a`)
      assert.equal(detail.seriesNavigation.next.id, b.id)
      for (const locale of ['zh', 'en']) {
        const response = await fetch(`${base}/feed.xml?locale=${locale}`)
        assert.match(response.headers.get('content-type')!, /application\/rss\+xml/)
        const feed = await response.text()
        assert(feed.includes(`${scope}-a`))
        assert(feed.includes(`${scope}-b`))
        assert(!feed.includes(`${scope}-hidden`))
        assert(!feed.includes(`${scope}-PRIVATE`))
        assert(!feed.includes(`${scope}-secret-new-slug`))
        assert.match(feed, /A &amp; B &lt;notes&gt;/)
      }
      const sitemap = await (await fetch(`${base}/sitemap.xml`)).text()
      assert(sitemap.includes(`/zh/posts/${scope}-a`))
      assert(!sitemap.includes(`/en/posts/${scope}-a`))
      assert(!sitemap.includes(`${scope}-hidden`))
      assert(!sitemap.includes('/admin'))
      assert(!sitemap.includes(`${scope}-secret-new-slug`))
      const html = await (await fetch(`${base}/en/posts/${scope}-a`)).text()
      assert.match(html, new RegExp(`rel="canonical" href="${base}/zh/posts/${scope}-a"`))
      assert.match(html, /onion-share\.png/)
      assert.match(html, /application\/rss\+xml/)
      assert.match(html, /id="section-1"/)
      const story = await request(`/api/content/${scope}-project?kind=project`)
      assert.equal(story.metadata.projectStory.outcome, 'A verified milestone')
      await request(`/api/admin/content/${project.id}/draft`, 'PUT', {
        ...body('project', 1),
        metadata: { projectStory: { demoUrl: 'https://example.test/private', outcome: 'PRIVATE RESULT' } },
        expectedVersion: 2,
      })
      assert.equal(
        (await request(`/api/content/${scope}-project?kind=project`)).metadata.projectStory.outcome,
        'A verified milestone',
      )
      await request(`/api/admin/content/${b.id}/unpublish`, 'POST', { locale: 'zh', expectedVersion: 2 })
      assert.deepEqual(
        (await request('/api/selections')).items.map((item: any) => item.id),
        [a.id, project.id],
      )
      detail = await request(`/api/content/${scope}-a?kind=blog`)
      assert.equal(detail.seriesNavigation.next, null)
      assert.equal(detail.related.length, 0)
      assert(!(await (await fetch(`${base}/feed.xml`)).text()).includes(`${scope}-b`))
      assert(!(await (await fetch(`${base}/sitemap.xml`)).text()).includes(`${scope}-b`))
      assert.equal((await fetch(`${base}/brand/onion-share.png`)).status, 200)
      assert.match(await (await fetch(`${base}/robots.txt`)).text(), /Sitemap:/)
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
        'contact-test.png',
      )
      const qr = await request('/api/admin/media', 'POST', form)
      assert.equal((await fetch(base + qr.url)).status, 404, 'unsaved QR stays private')
      const currentSettings = await request('/api/admin/site')
      const contact = {
        qq: '123456789',
        wechat: 'test-contact',
        email: 'name+tag@example.test',
        wechatQrId: qr.id,
      }
      const withContact = { ...currentSettings, config: { ...currentSettings.config, contact } }
      await request(
        '/api/admin/site',
        'PUT',
        {
          ...withContact,
          config: { ...withContact.config, contact: { ...contact, wechatQrId: randomUUID() } },
        },
        422,
      )
      await request('/api/admin/site', 'PUT', withContact)
      assert.equal((await fetch(base + qr.url)).status, 200, 'saved QR is public')
      const about = await (await fetch(`${base}/zh/about`)).text()
      assert.match(about, /tencent:\/\/AddContact\//)
      assert.match(about, /mailto:name%2Btag@example.test/)
      assert(about.includes(qr.id))
      await request('/api/admin/site', 'PUT', {
        ...withContact,
        config: {
          ...withContact.config,
          contact: { qq: contact.qq, wechat: '', email: '', wechatQrId: null },
        },
      })
      assert.equal((await fetch(base + qr.url)).status, 404, 'removed QR loses public access')
      assert.match(await (await fetch(`${base}/zh`)).text(), /\/zh\/about#contact/)
    } finally {
      await request('/api/admin/site', 'PUT', settings)
      for (const id of ids) await request(`/api/admin/content/${id}`, 'DELETE')
      await request('/api/auth/logout', 'POST')
    }
  },
)
