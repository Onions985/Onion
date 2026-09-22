import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { randomUUID, createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { isDeepStrictEqual } from 'node:util'
import mysql from 'mysql2/promise'
import { draftSchema } from '../shared/validation.ts'
import { messages } from '../database/seed.mjs'

const args = process.argv.slice(2)
const batch = args.find(arg => arg.startsWith('--batch='))?.slice(8)
if (!batch || !/^[a-z][a-z0-9-]+$/.test(batch) || args.some(arg => !['--apply', '--check', `--batch=${batch}`].includes(arg))) {
  throw new Error('Use --batch=<directory> --check or --apply')
}
const apply = args.includes('--apply')
const directory = new URL(`../docs/articles/${batch}/`, import.meta.url)
const runtime = new URL(`../.runtime/${batch}/`, import.meta.url)
const manifest = JSON.parse(await readFile(new URL('manifest.json', directory), 'utf8'))
const compiledOn = manifest.compiledOn
const independent = manifest.sourceType === 'independent'
if (manifest.sourceType && !['project', 'independent'].includes(manifest.sourceType)) throw new Error('Invalid source type')
if (!/^\d{4}-\d{2}-\d{2}$/.test(compiledOn) || compiledOn > new Date().toISOString().slice(0, 10)) throw new Error('Invalid compilation date')
const url = new URL(process.env.DATABASE_URL)
if (url.hostname !== '127.0.0.1' || url.port !== '3317' || url.pathname !== '/onion') throw new Error('Local Onion only')
const allowedRepos = new Set(['pic-agent-java', 'pic-agent-kmp', 'pic-agent-android', 'pic-agent-ios', 'pic-agent-harmony'])
const digest = value => createHash('sha256').update(value).digest('hex')
const evidence = []
const articles = []
for (const article of manifest.articles) {
  const sources = article.sources.map(source => {
    if (independent) {
      const reference = new URL(source.url)
      if (reference.protocol !== 'https:' || reference.username || reference.password || !source.title || source.verifiedOn !== compiledOn) throw new Error('Invalid reference')
      return { title: source.title, url: reference.href, verifiedOn: source.verifiedOn }
    }
    if (!allowedRepos.has(source.repo) || !/^[a-f0-9]{7,40}$/.test(source.commit)) throw new Error('Invalid source')
    const cwd = fileURLToPath(new URL(`../../picagent/${source.repo}`, import.meta.url))
    const git = (...argv) => execFileSync('git', ['-c', `safe.directory=${cwd.replaceAll('\\', '/')}`, ...argv], { cwd, encoding: 'utf8', maxBuffer: 3 * 1024 * 1024, windowsHide: true })
    const [commit, authoredAt] = git('show', '-s', '--format=%H%n%aI', source.commit).trim().split('\n')
    const files = source.files.map(path => {
      if (path.includes('..') || !/\.(kt|swift|ets|md|sql|xml)$/.test(path)) throw new Error('Unexpected source path')
      return { path, sha256: digest(git('show', `${commit}:${path}`)) }
    })
    return { repo: source.repo, commit, authoredAt, files }
  })
  if (!sources.length) throw new Error('Sources required')
  const archiveDate = independent ? article.archiveDate : sources[0].authoredAt.slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(archiveDate) || archiveDate < (independent ? '2022-01-01' : '2025-09-22') || archiveDate > compiledOn) throw new Error('Source outside requested dates')
  if (!/^[a-z0-9-]+\.md$/.test(article.file)) throw new Error('Invalid article file')
  const markdown = await readFile(new URL(article.file, directory), 'utf8')
  if (markdown.length < 1000 || !markdown.includes(compiledOn) || !markdown.includes(archiveDate)) throw new Error(`Missing provenance: ${article.slug}`)
  if (independent && (markdown.length < 1800 || !markdown.includes('专题归档') || sources.some(source => !markdown.includes(source.url)))) throw new Error(`Missing independent article context: ${article.slug}`)
  const draft = draftSchema.parse({ locale: 'zh', slug: article.slug, title: article.title, summary: article.summary, markdown, metadata: { category: article.category, tags: article.tags }, expectedVersion: 0 })
  articles.push({ ...draft, archiveDate })
  evidence.push({ slug: article.slug, archiveDate, compiledOn, markdownSha256: digest(markdown), sources })
}
if (new Set(articles.map(a => a.slug)).size !== articles.length) throw new Error('Duplicate slug')
const db = await mysql.createConnection({ host: url.hostname, port: +url.port, user: decodeURIComponent(url.username), password: decodeURIComponent(url.password), database: 'onion', charset: 'utf8mb4', timezone: 'Z', dateStrings: true })
try {
  await db.query("SET time_zone = '+00:00'")
  await db.beginTransaction()
  const [[identity]] = await db.query('SELECT DATABASE() AS name,@@port AS port')
  if (identity.name !== 'onion' || +identity.port !== 3317) throw new Error('Wrong database')
  await db.query('SELECT id FROM site_settings WHERE id=1 FOR UPDATE')
  const [[author]] = await db.execute('SELECT id FROM users WHERE email=?', [process.env.ADMIN_EMAIL])
  if (!author) throw new Error('Configured author missing')
  const [rows] = await db.query(`SELECT c.id AS contentId,c.kind,c.author_id AS authorId,c.archived_at AS archivedAt,t.id AS translationId,t.locale,t.published_slug AS publishedSlug,t.published_revision_id AS publishedRevisionId,t.published_at AS publishedAt,r.slug,r.title,r.summary,r.markdown,r.metadata
    FROM content_items c JOIN content_translations t ON t.content_id=c.id JOIN content_revisions r ON r.id=t.draft_revision_id FOR UPDATE`)
  for (const article of articles) {
    const matches = rows.filter(row => row.slug === article.slug || row.publishedSlug === article.slug)
    const changed = matches.some(row =>
      row.kind !== 'blog' || row.locale !== 'zh' || row.archivedAt || row.authorId !== author.id ||
      !row.publishedRevisionId || row.publishedSlug !== article.slug || row.title !== article.title ||
      row.summary !== article.summary || row.markdown !== article.markdown ||
      !isDeepStrictEqual(typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata, article.metadata),
    )
    if (matches.length && (matches.length !== 1 || changed)) {
      throw new Error(`Existing article was edited or unpublished; preserved: ${article.slug}`)
    }
  }
  console.log(JSON.stringify({ mode: apply ? 'apply' : 'check', articles: articles.map(a => ({ slug: a.slug, date: a.archiveDate, characters: a.markdown.length })), newArticles: articles.filter(a => !rows.some(row => row.slug === a.slug)).length }))
  if (!apply) { await db.rollback() }
  else {
    await mkdir(runtime, { recursive: true })
    const backupName = `before-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
    const backup = {}
    for (const table of ['content_items', 'content_translations', 'content_revisions', 'ui_messages']) [backup[table]] = await db.query(`SELECT * FROM ${table}`)
    await writeFile(new URL(backupName, runtime), JSON.stringify(backup, null, 2), { flag: 'wx' })
    const published = []
    for (const article of articles) {
      let contentId = rows.find(row => row.slug === article.slug)?.contentId
      if (!contentId) {
        contentId = randomUUID()
        const translationId = randomUUID(), revisionId = randomUUID()
        await db.execute("INSERT INTO content_items(id,kind,author_id) VALUES(?,'blog',?)", [contentId, author.id])
        await db.execute("INSERT INTO content_translations(id,content_id,locale) VALUES(?,?,'zh')", [translationId, contentId])
        await db.execute('INSERT INTO content_revisions(id,translation_id,slug,title,summary,markdown,cover_id,metadata) VALUES(?,?,?,?,?,?,NULL,?)', [revisionId, translationId, article.slug, article.title, article.summary, article.markdown, JSON.stringify(article.metadata)])
        await db.execute('UPDATE content_translations SET draft_revision_id=?,published_revision_id=?,published_slug=?,published_at=?,version=2 WHERE id=?', [revisionId, revisionId, article.slug, `${article.archiveDate} 00:00:00.000`, translationId])
      }
      published.push({ id: contentId, slug: article.slug, date: article.archiveDate })
    }
    for (const message of messages.filter(m => ['writing.moreTags', 'writing.lessTags'].includes(m.key))) {
      await db.execute('INSERT INTO ui_messages(locale,message_key,value) VALUES(?,?,?) ON DUPLICATE KEY UPDATE value=?', [message.locale, message.key, message.value, message.value])
    }
    for (const article of articles) {
      const [[stored]] = await db.execute(`SELECT r.markdown,t.published_at AS publishedAt,c.author_id AS authorId FROM content_translations t JOIN content_items c ON c.id=t.content_id JOIN content_revisions r ON r.id=t.published_revision_id WHERE t.locale='zh' AND t.published_slug=?`, [article.slug])
      if (stored.markdown !== article.markdown || stored.authorId !== author.id || stored.publishedAt.slice(0,10) !== article.archiveDate) throw new Error('Database verification failed')
    }
    await db.commit()
    await writeFile(new URL('source-evidence.json', directory), JSON.stringify(evidence, null, 2) + '\n')
    await writeFile(new URL('publication-result.json', runtime), JSON.stringify({ importedAt: new Date().toISOString(), backupName, published }, null, 2))
    console.log(`Published ${published.length} articles; existing content preserved.`)
  }
} catch (error) { await db.rollback(); throw error }
finally { await db.end() }
