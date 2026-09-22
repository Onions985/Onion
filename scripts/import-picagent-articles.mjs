import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { randomUUID, createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import mysql from 'mysql2/promise'
import { draftSchema, configSchema } from '../shared/validation.ts'

// 一次编辑导入：只访问 Onion 本地数据库，PicAgent 仓库只用于读取历史源码。
const apply = process.argv.includes('--apply')
if (process.argv.slice(2).some(arg => !['--check', '--apply'].includes(arg))) throw new Error('Use --check or --apply')
const directory = new URL('../docs/articles/picagent/', import.meta.url)
const sourceRoot = new URL('../../picagent/', import.meta.url)
const runtime = new URL('../.runtime/picagent-articles/', import.meta.url)
const previousDirectory = new URL('../.runtime/technical-articles-20260921/', import.meta.url)
const manifest = JSON.parse(await readFile(new URL('manifest.json', directory), 'utf8'))
const previous = JSON.parse(await readFile(new URL('manifest.json', previousDirectory), 'utf8'))
const url = new URL(process.env.DATABASE_URL)
if (url.protocol !== 'mysql:' || url.hostname !== '127.0.0.1' || url.port !== '3317' || url.pathname !== '/onion') {
  throw new Error('Import is restricted to local Onion on port 3317')
}
const digest = text => createHash('sha256').update(text).digest('hex')
const git = (repo, ...args) => {
  const cwd = fileURLToPath(new URL(`${repo}/`, sourceRoot)).replace(/[\\/]$/, '')
  // 仅本次只读命令信任已限定的源码目录，不改用户的全局 Git 配置。
  return execFileSync('git', ['-c', `safe.directory=${cwd.replaceAll('\\', '/')}`, ...args], {
    cwd, encoding: 'utf8', maxBuffer: 3 * 1024 * 1024,
  })
}
const allowedRepos = new Set(['pic-agent-android', 'pic-agent-kmp', 'pic-agent-ios', 'pic-agent-java', 'pic-agent-harmony'])
const evidence = []
const articles = []
for (const article of manifest) {
  const sources = article.sources.map(source => {
    if (!allowedRepos.has(source.repo) || !/^[a-f0-9]{7,40}$/.test(source.commit)) throw new Error('Invalid source identity')
    const [commit, authoredAt] = git(source.repo, 'show', '-s', '--format=%H%n%aI', source.commit).trim().split('\n')
    const files = source.files.map(path => {
      if (path.includes('..') || /(?:local\.properties|\.env|\.ya?ml$|\.jks$)/i.test(path)) throw new Error('Unexpected source path')
      const text = git(source.repo, 'show', `${commit}:${path}`)
      return { path, sha256: digest(text) }
    })
    return { repo: source.repo, commit, authoredAt, files }
  })
  // 归档到提交所在时区的自然日；不伪造文章创建时间或某个具体发布时刻。
  const archiveDate = sources[0].authoredAt.slice(0, 10)
  if (archiveDate < '2025-09-21' || archiveDate > '2026-09-21') throw new Error('Source is outside the requested year')
  const markdown = await readFile(new URL(article.file, directory), 'utf8')
  if (!markdown.includes(archiveDate) || !markdown.includes('2026-09-21') || markdown.length < 1000) throw new Error(`Article provenance missing: ${article.slug}`)
  const draft = draftSchema.parse({
    locale: 'zh', slug: article.slug, title: article.title, summary: article.summary, markdown,
    metadata: { category: article.category, tags: article.tags }, expectedVersion: 0,
  })
  articles.push({ ...draft, archiveDate })
  evidence.push({ slug: article.slug, archiveDate, compiledOn: '2026-09-21', markdownSha256: digest(markdown), sources })
}
if (new Set(articles.map(a => a.slug)).size !== articles.length) throw new Error('Duplicate article slug')
const previousBodies = new Map(await Promise.all(previous.map(async item => [item.slug, {
  title: item.title, markdown: await readFile(new URL(item.file, previousDirectory), 'utf8'),
}])))
const db = await mysql.createConnection({
  host: url.hostname, port: Number(url.port), user: decodeURIComponent(url.username), password: decodeURIComponent(url.password),
  database: 'onion', charset: 'utf8mb4', timezone: 'Z', dateStrings: true,
})
let committed = false
try {
  await db.query("SET time_zone = '+00:00'")
  await db.beginTransaction()
  const [[identity]] = await db.query('SELECT DATABASE() AS name,@@port AS port')
  if (identity.name !== 'onion' || Number(identity.port) !== 3317) throw new Error('Database identity mismatch')
  const [[settings]] = await db.query('SELECT config FROM site_settings WHERE id=1 FOR UPDATE')
  const [[author]] = await db.execute('SELECT id FROM users WHERE email=?', [process.env.ADMIN_EMAIL])
  if (!author) throw new Error('Existing site author not found')
  const [rows] = await db.query(`SELECT c.id AS contentId,c.kind,c.author_id AS authorId,c.archived_at AS archivedAt,
    t.id AS translationId,t.locale,t.version,t.draft_revision_id AS draftRevisionId,t.published_revision_id AS publishedRevisionId,
    t.published_slug AS publishedSlug,t.published_at AS publishedAt,r.slug,r.title,r.markdown
    FROM content_items c JOIN content_translations t ON t.content_id=c.id
    JOIN content_revisions r ON r.id=t.draft_revision_id FOR UPDATE`)
  const originals = []
  for (const [slug, original] of previousBodies) {
    const row = rows.find(r => r.locale === 'zh' && r.slug === slug)
    if (!row || row.kind !== 'blog' || row.authorId !== author.id || row.title !== original.title || row.markdown !== original.markdown) {
      throw new Error(`Prior article changed; preserved without importing: ${slug}`)
    }
    originals.push(row)
  }
  for (const article of articles) {
    const existing = rows.filter(r => r.slug === article.slug || r.publishedSlug === article.slug)
    if (existing.some(r => r.locale !== 'zh' || r.kind !== 'blog' || r.archivedAt || r.authorId !== author.id || r.markdown !== article.markdown || r.title !== article.title)) {
      throw new Error(`Article slug is already used or edited: ${article.slug}`)
    }
  }
  console.log(JSON.stringify({ mode: apply ? 'apply' : 'check', target: '127.0.0.1:3317/onion',
    articles: articles.map(a => ({ title: a.title, date: a.archiveDate, category: a.metadata.category, characters: a.markdown.length })),
    priorPublishedToUnpublish: originals.filter(r => r.publishedRevisionId).length,
  }, null, 2))
  if (!apply) {
    await db.rollback()
  } else {
    await mkdir(runtime, { recursive: true })
    const backupName = `before-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
    const [items] = await db.query('SELECT * FROM content_items')
    const [translations] = await db.query('SELECT * FROM content_translations')
    const [revisions] = await db.query('SELECT * FROM content_revisions')
    await writeFile(new URL(backupName, runtime), JSON.stringify({ settings, items, translations, revisions }, null, 2), { flag: 'wx' })
    const published = []
    for (const article of articles) {
      let row = rows.find(r => r.locale === 'zh' && r.slug === article.slug)
      if (!row) {
        const contentId = randomUUID(), translationId = randomUUID(), revisionId = randomUUID()
        await db.execute("INSERT INTO content_items(id,kind,author_id) VALUES(?,'blog',?)", [contentId, author.id])
        await db.execute("INSERT INTO content_translations(id,content_id,locale) VALUES(?,?,'zh')", [translationId, contentId])
        await db.execute('INSERT INTO content_revisions(id,translation_id,slug,title,summary,markdown,cover_id,metadata) VALUES(?,?,?,?,?,?,NULL,?)',
          [revisionId, translationId, article.slug, article.title, article.summary, article.markdown, JSON.stringify(article.metadata)])
        await db.execute(`UPDATE content_translations SET draft_revision_id=?,published_revision_id=?,published_slug=?,published_at=?,version=2 WHERE id=?`,
          [revisionId, revisionId, article.slug, `${article.archiveDate} 00:00:00.000`, translationId])
        row = { contentId }
      } else if (!row.publishedRevisionId) {
        throw new Error(`Existing article was unpublished; do not republish automatically: ${article.slug}`)
      }
      published.push({ id: row.contentId, slug: article.slug, date: article.archiveDate })
    }
    for (const row of originals) {
      if (!row.publishedRevisionId) continue
      const [result] = await db.execute('UPDATE content_translations SET published_revision_id=NULL,published_slug=NULL,published_at=NULL,version=version+1 WHERE id=? AND version=?', [row.translationId, row.version])
      if (result.affectedRows !== 1) throw new Error('Concurrent edit detected')
      await db.execute('UPDATE content_items SET updated_at=UTC_TIMESTAMP(3) WHERE id=?', [row.contentId])
    }
    const oldConfig = typeof settings.config === 'string' ? JSON.parse(settings.config) : settings.config
    const preferred = ['Android', 'iOS', 'KMP', 'Java', 'Spring', 'SpringBoot', 'SQL', '鸿蒙', 'AI', '随想']
    const config = configSchema.parse({ ...oldConfig, writingTags: [...new Set([...preferred, ...oldConfig.writingTags])] })
    await db.execute('UPDATE site_settings SET config=? WHERE id=1', [JSON.stringify(config)])
    for (const article of articles) {
      const [[stored]] = await db.execute(`SELECT r.markdown,t.published_at AS publishedAt FROM content_translations t
        JOIN content_revisions r ON r.id=t.published_revision_id WHERE t.locale='zh' AND t.published_slug=?`, [article.slug])
      if (!stored || stored.markdown !== article.markdown || stored.publishedAt.slice(0, 10) !== article.archiveDate) throw new Error('Stored article verification failed')
    }
    await db.commit()
    committed = true
    await writeFile(new URL('source-evidence.json', directory), JSON.stringify(evidence, null, 2) + '\n')
    await writeFile(new URL('publication-result.json', runtime), JSON.stringify({ importedAt: new Date().toISOString(), backupName, published, unpublished: originals.map(r => r.contentId) }, null, 2))
    console.log(`Committed ${articles.length} articles; original articles retained as drafts.`)
  }
} catch (error) {
  if (!committed) await db.rollback()
  throw error
} finally {
  await db.end()
}
