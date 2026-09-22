import { readFile, writeFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import assert from 'node:assert/strict'
import { isDeepStrictEqual } from 'node:util'
import mysql from 'mysql2/promise'
import { metadataSchema } from '../shared/validation.ts'

assert(process.argv.length === 3 && ['--check', '--apply'].includes(process.argv[2]), 'Use --check or --apply')
const apply = process.argv[2] === '--apply'
const allowed = ['opc-devops', 'talking-rounds', 'tanxiaoer']
const manifest = JSON.parse(await readFile('docs/projects/manifest.json', 'utf8'))
const snapshot = JSON.parse(await readFile('.runtime/project-sections/before.json', 'utf8'))
assert.deepEqual(manifest.projects.map(p => p.slug).sort(), [...allowed].sort())
const modules = new Map(manifest.projects.map(p => [p.slug, metadataSchema.parse(p.metadata).projectModules]))
for (const entries of modules.values()) assert(entries.length > 0)
const url = new URL(process.env.DATABASE_URL)
assert(url.hostname === '127.0.0.1' && url.port === '3317' && url.pathname === '/onion', 'Local Onion database only')
const db = await mysql.createConnection({ host: url.hostname, port: +url.port,
  user: decodeURIComponent(url.username), password: decodeURIComponent(url.password),
  database: 'onion', charset: 'utf8mb4', timezone: 'Z', dateStrings: true })
const select = `SELECT c.id,c.kind,c.author_id,t.id AS translationId,t.locale,t.version,t.draft_revision_id,
  t.published_revision_id,t.published_at,t.published_slug,r.slug,r.title,r.summary,r.markdown,r.cover_id,r.metadata
  FROM content_items c JOIN content_translations t ON t.content_id=c.id
  JOIN content_revisions r ON r.id=t.published_revision_id
  WHERE c.kind='project' AND c.archived_at IS NULL AND t.locale='zh'
  AND r.slug IN ('opc-devops','talking-rounds','tanxiaoer')`
const normalize = row => JSON.parse(JSON.stringify({ ...row,
  metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata }))
try {
  await db.beginTransaction()
  const [[identity]] = await db.query('SELECT DATABASE() AS name,@@port AS port')
  assert(identity.name === 'onion' && +identity.port === 3317)
  await db.query('SELECT id FROM site_settings WHERE id=1 FOR UPDATE')
  const [rows] = await db.query(`${select} FOR UPDATE`)
  assert.equal(rows.length, 3)
  const before = rows.map(normalize), pending = []
  for (const row of before) {
    assert.equal(row.draft_revision_id, row.published_revision_id, `Preserve unpublished draft: ${row.slug}`)
    if (isDeepStrictEqual(row.metadata.projectModules, modules.get(row.slug))) continue
    assert.deepEqual(row, snapshot.find(old => old.slug === row.slug), `Project edited after review: ${row.slug}`)
    assert.equal(row.metadata.projectModules?.length || 0, 0, `Preserve existing modules: ${row.slug}`)
    pending.push(row)
  }
  console.log(JSON.stringify({ mode: apply ? 'apply' : 'check', projects: before.map(row => ({ slug: row.slug,
    modules: modules.get(row.slug).length, screenshots: row.metadata.projectScreenshots?.length || 0 })), updates: pending.length }))
  if (!apply || !pending.length) {
    await db.rollback()
  } else {
    const [pinsBefore] = await db.query('SELECT * FROM content_pins ORDER BY kind')
    const [otherTranslations] = await db.query(`SELECT id,draft_revision_id,published_revision_id,version,published_at FROM content_translations
      WHERE id NOT IN (?,?,?) ORDER BY id`, before.map(row => row.translationId))
    const [countsBefore] = await db.query('SELECT kind,COUNT(*) AS count FROM content_items WHERE archived_at IS NULL GROUP BY kind ORDER BY kind')
    const [commentsBefore] = await db.query('SELECT COUNT(*) AS count FROM comments')
    const [mediaBefore] = await db.query('SELECT COUNT(*) AS count FROM media_assets')
    await writeFile(`.runtime/project-sections/before-apply-${Date.now()}.json`, JSON.stringify(before, null, 2), { flag: 'wx' })
    const published = []
    for (const row of pending) {
      const revisionId = randomUUID()
      const metadata = { ...row.metadata, projectModules: modules.get(row.slug) }
      metadataSchema.parse(metadata)
      await db.execute('INSERT INTO content_revisions(id,translation_id,slug,title,summary,markdown,cover_id,metadata) VALUES(?,?,?,?,?,?,?,?)',
        [revisionId, row.translationId, row.slug, row.title, row.summary, row.markdown, row.cover_id, JSON.stringify(metadata)])
      await db.execute('INSERT INTO revision_media(revision_id,media_id) SELECT ?,media_id FROM revision_media WHERE revision_id=?',
        [revisionId, row.published_revision_id])
      const [result] = await db.execute('UPDATE content_translations SET draft_revision_id=?,published_revision_id=?,version=version+2 WHERE id=? AND version=?',
        [revisionId, revisionId, row.translationId, row.version])
      assert.equal(result.affectedRows, 1)
      await db.execute('UPDATE content_items SET updated_at=UTC_TIMESTAMP(3) WHERE id=?', [row.id])
      published.push({ slug: row.slug, revisionId, previousRevisionId: row.published_revision_id })
    }
    const [afterRows] = await db.query(select)
    for (const row of afterRows.map(normalize)) {
      const old = before.find(item => item.slug === row.slug)
      const change = published.find(item => item.slug === row.slug)
      if (!change) { assert.deepEqual(row, old); continue }
      assert.deepEqual(row, { ...old, version: old.version + 2, draft_revision_id: change.revisionId,
        published_revision_id: change.revisionId, metadata: { ...old.metadata, projectModules: modules.get(row.slug) } })
      const [oldMedia] = await db.execute('SELECT media_id FROM revision_media WHERE revision_id=? ORDER BY media_id', [old.published_revision_id])
      const [newMedia] = await db.execute('SELECT media_id FROM revision_media WHERE revision_id=? ORDER BY media_id', [change.revisionId])
      assert.deepEqual(newMedia, oldMedia)
    }
    const [pinsAfter] = await db.query('SELECT * FROM content_pins ORDER BY kind')
    const [otherAfter] = await db.query(`SELECT id,draft_revision_id,published_revision_id,version,published_at FROM content_translations
      WHERE id NOT IN (?,?,?) ORDER BY id`, before.map(row => row.translationId))
    const [countsAfter] = await db.query('SELECT kind,COUNT(*) AS count FROM content_items WHERE archived_at IS NULL GROUP BY kind ORDER BY kind')
    const [commentsAfter] = await db.query('SELECT COUNT(*) AS count FROM comments')
    const [mediaAfter] = await db.query('SELECT COUNT(*) AS count FROM media_assets')
    assert.deepEqual(pinsAfter, pinsBefore)
    assert.deepEqual(otherAfter, otherTranslations)
    assert.deepEqual(countsAfter, countsBefore)
    assert.deepEqual(commentsAfter, commentsBefore)
    assert.deepEqual(mediaAfter, mediaBefore)
    await db.commit()
    await writeFile('.runtime/project-sections/publication-result.json', JSON.stringify({ publishedAt: new Date().toISOString(), published,
      preserved: ['authors', 'dates', 'covers', 'comments', 'pins', 'other content', 'revision history'] }, null, 2))
    console.log(`Published ${published.length} project module revisions; all other content preserved.`)
  }
} catch (error) { await db.rollback(); throw error }
finally { await db.end() }
