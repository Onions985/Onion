import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { randomUUID, createHash } from 'node:crypto'
import { isDeepStrictEqual } from 'node:util'
import assert from 'node:assert/strict'
import mysql from 'mysql2/promise'
import { draftSchema } from '../shared/validation.ts'

assert(process.argv.length === 3 && ['--check', '--apply'].includes(process.argv[2]), 'Use --check or --apply')
const apply = process.argv[2] === '--apply'
const root = new URL('../docs/projects/', import.meta.url)
const runtime = new URL('../.runtime/project-import/', import.meta.url)
const manifest = JSON.parse(await readFile(new URL('manifest.json', root), 'utf8'))
const allowed = new Set(['opc-devops', 'talking-rounds', 'tanxiaoer'])
const projects = [], evidence = []
const hash = value => createHash('sha256').update(value).digest('hex')
for (const project of manifest.projects) {
  assert(allowed.has(project.slug) && project.file === `${project.slug}.md`, 'Unexpected project')
  assert.equal(project.metadata.projectUrl, `https://github.com/${project.slug}`)
  assert.equal(project.metadata.repositoryUrl, '', 'No publicly verified repository')
  const markdown = await readFile(new URL(project.file, root), 'utf8')
  projects.push(draftSchema.parse({ ...project, locale: 'zh', markdown, expectedVersion: 0 }))
  evidence.push({ slug: project.slug, github: project.metadata.projectUrl, publicRepositoriesVisible: false, verifiedOn: manifest.verifiedOn, markdownSha256: hash(markdown), sources: await Promise.all(project.sources.map(async path => ({ path, sha256: hash(await readFile(path)) }))) })
}
assert.equal(projects.length, 3)
assert.equal(new Set(projects.map(p => p.slug)).size, 3)
const url = new URL(process.env.DATABASE_URL)
assert(url.hostname === '127.0.0.1' && url.port === '3317' && url.pathname === '/onion', 'Local Onion database only')
const db = await mysql.createConnection({ host: url.hostname, port: +url.port, user: decodeURIComponent(url.username), password: decodeURIComponent(url.password), database: 'onion', charset: 'utf8mb4', timezone: 'Z', dateStrings: true })
try {
  await db.beginTransaction()
  const [[identity]] = await db.query('SELECT DATABASE() AS name,@@port AS port')
  assert(identity.name === 'onion' && +identity.port === 3317)
  await db.query('SELECT id FROM site_settings WHERE id=1 FOR UPDATE')
  const [[author]] = await db.execute('SELECT id FROM users WHERE email=?', [process.env.ADMIN_EMAIL])
  assert(author, 'Configured administrator missing')
  const tables = ['content_items', 'content_translations', 'content_revisions', 'revision_media']
  const before = {}
  for (const table of tables) [before[table]] = await db.query(`SELECT * FROM ${table} FOR UPDATE`)
  const [existing] = await db.query(`SELECT c.id,c.kind,c.author_id,c.archived_at,t.locale,t.published_revision_id,t.draft_revision_id,t.published_slug,r.slug,r.title,r.summary,r.markdown,r.metadata
    FROM content_items c JOIN content_translations t ON t.content_id=c.id JOIN content_revisions r ON r.id=t.draft_revision_id`)
  const additions = []
  for (const project of projects) {
    const matches = existing.filter(row => row.slug === project.slug || row.published_slug === project.slug || (row.kind === 'project' && (typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata).projectUrl === project.metadata.projectUrl))
    if (!matches.length) { additions.push(project); continue }
    assert.equal(matches.length, 1, 'Duplicate project identity')
    const row = matches[0], metadata = typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata
    assert(row.kind === 'project' && row.author_id === author.id && !row.archived_at && row.locale === 'zh' && row.published_revision_id === row.draft_revision_id && row.published_slug === project.slug && row.title === project.title && row.summary === project.summary && row.markdown === project.markdown && isDeepStrictEqual(metadata, project.metadata), `Existing edits preserved: ${project.slug}`)
  }
  console.log(JSON.stringify({ mode: apply ? 'apply' : 'check', newProjects: additions.length, projects: projects.map(p => ({ title: p.title, url: p.metadata.projectUrl })), existingContent: before.content_items.length }))
  if (!apply) { await db.rollback() }
  else {
    await mkdir(runtime, { recursive: true })
    const backup = `before-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
    await writeFile(new URL(backup, runtime), JSON.stringify(before, null, 2), { flag: 'wx' })
    const created = []
    for (const project of additions) {
      const id = randomUUID(), translationId = randomUUID(), revisionId = randomUUID()
      await db.execute("INSERT INTO content_items(id,kind,author_id) VALUES(?,'project',?)", [id, author.id])
      await db.execute("INSERT INTO content_translations(id,content_id,locale) VALUES(?,?,'zh')", [translationId, id])
      await db.execute('INSERT INTO content_revisions(id,translation_id,slug,title,summary,markdown,cover_id,metadata) VALUES(?,?,?,?,?,?,NULL,?)', [revisionId, translationId, project.slug, project.title, project.summary, project.markdown, JSON.stringify(project.metadata)])
      await db.execute('UPDATE content_translations SET draft_revision_id=?,published_revision_id=?,published_slug=?,published_at=UTC_TIMESTAMP(3),version=2 WHERE id=?', [revisionId, revisionId, project.slug, translationId])
      created.push({ id, slug: project.slug })
    }
    for (const table of tables) {
      const [after] = await db.query(`SELECT * FROM ${table}`)
      for (const old of before[table]) assert(after.some(row => isDeepStrictEqual(row, old)), `Existing ${table} row changed`)
    }
    for (const project of projects) {
      const [[row]] = await db.execute(`SELECT c.author_id,r.markdown,r.metadata FROM content_items c JOIN content_translations t ON t.content_id=c.id JOIN content_revisions r ON r.id=t.published_revision_id WHERE c.kind='project' AND c.archived_at IS NULL AND t.locale='zh' AND t.published_slug=?`, [project.slug])
      assert(row && row.author_id === author.id && row.markdown === project.markdown)
      assert(isDeepStrictEqual(typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata, project.metadata))
    }
    await db.commit()
    await writeFile(new URL('source-evidence.json', root), JSON.stringify(evidence, null, 2) + '\n')
    await writeFile(new URL('publication-result.json', runtime), JSON.stringify({ importedAt: new Date().toISOString(), backup, created, preservedContent: before.content_items.length }, null, 2))
    console.log(`Published ${created.length} projects; all existing content preserved.`)
  }
} catch (error) { await db.rollback(); throw error }
finally { await db.end() }
