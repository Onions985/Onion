import { readFile, writeFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import assert from 'node:assert/strict'
import mysql from 'mysql2/promise'
import { draftSchema } from '../shared/validation.ts'

assert(process.argv.length === 3 && ['--check', '--apply'].includes(process.argv[2]), 'Use --check or --apply')
const apply = process.argv[2] === '--apply'
const review = new URL('../.runtime/copy-review/', import.meta.url)
const changes = JSON.parse(await readFile(new URL('changes.json', review), 'utf8'))
assert.equal(changes.length, 64)
assert.equal(new Set(changes.map(c => `${c.id}:${c.locale}`)).size, changes.length)
for (const change of changes) {
  assert(['blog', 'project'].includes(change.kind))
  draftSchema.parse({ ...change.after, expectedVersion: change.before.version })
  for (const key of Object.keys(change.before)) {
    if (!['summary', 'markdown', 'metadata'].includes(key))
      assert.deepEqual(change.after[key], change.before[key], `Unexpected change to ${change.slug}.${key}`)
  }
  const { projectModules: oldModules, ...oldMetadata } = change.before.metadata
  const { projectModules: newModules, ...newMetadata } = change.after.metadata
  assert.deepEqual(newMetadata, oldMetadata, `Preserve metadata: ${change.slug}`)
  if (change.slug !== 'picagent') assert.deepEqual(newModules, oldModules)
}

const url = new URL(process.env.DATABASE_URL)
assert(url.hostname === '127.0.0.1' && url.port === '3317' && url.pathname === '/onion', 'Local Onion database only')
const db = await mysql.createConnection({ host: url.hostname, port: +url.port,
  user: decodeURIComponent(url.username), password: decodeURIComponent(url.password),
  // Match the Shanghai-local timestamp decoding used by the review snapshot.
  // published_at itself is never rewritten by this copy edit.
  database: 'onion', charset: 'utf8mb4', timezone: '+08:00' })
const selectPublished = `SELECT c.id,c.kind,t.locale,t.version,t.draft_revision_id AS draftRevisionId,
  t.published_revision_id AS publishedRevisionId,t.published_at AS publishedAt,
  r.slug,r.title,r.summary,r.markdown,r.cover_id AS coverId,r.metadata
  FROM content_items c JOIN content_translations t ON t.content_id=c.id
  JOIN content_revisions r ON r.id=t.published_revision_id WHERE c.archived_at IS NULL`
const normalize = row => JSON.parse(JSON.stringify({ ...row,
  metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata }))
const protectedTables = ['content_pins', 'comments', 'media_assets', 'site_profiles', 'ui_messages']
try {
  await db.beginTransaction()
  const [[identity]] = await db.query('SELECT DATABASE() AS name,@@port AS port')
  assert(identity.name === 'onion' && +identity.port === 3317)
  await db.query('SELECT id FROM site_settings WHERE id=1 FOR UPDATE')
  const [rows] = await db.query(`${selectPublished} FOR UPDATE`)
  const before = rows.map(normalize)
  const byId = new Map(before.map(row => [`${row.id}:${row.locale}`, row]))
  for (const change of changes) {
    const current = byId.get(`${change.id}:${change.locale}`)
    assert.deepEqual(current, change.before, `Content changed since review; preserve edits: ${change.slug}`)
    assert.equal(current.draftRevisionId, current.publishedRevisionId, `Unpublished draft: ${change.slug}`)
  }
  const [[counts]] = await db.query('SELECT COUNT(*) AS revisions FROM content_revisions')
  const [translations] = await db.query('SELECT * FROM content_translations FOR UPDATE')
  const [items] = await db.query('SELECT id,kind,author_id,archived_at,created_at FROM content_items ORDER BY id')
  const protectedBefore = {}
  for (const table of protectedTables) [protectedBefore[table]] = await db.query(`SELECT * FROM ${table} ORDER BY 1`)
  const [mediaBefore] = await db.query('SELECT * FROM revision_media ORDER BY revision_id,media_id')
  console.log(JSON.stringify({ mode: apply ? 'apply' : 'check', projects: 4, blogs: 60,
    publishedContent: before.length, concurrentEdits: false, pendingDrafts: false }))
  if (!apply) {
    await db.rollback()
  } else {
    const backup = `before-apply-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
    await writeFile(new URL(backup, review), JSON.stringify({ before, translations, items, mediaBefore }, null, 2), { flag: 'wx' })
    const published = []
    for (const change of changes) {
      const next = change.after, revisionId = randomUUID()
      const translation = translations.find(t => t.content_id === change.id && t.locale === change.locale)
      await db.execute('INSERT INTO content_revisions(id,translation_id,slug,title,summary,markdown,cover_id,metadata) VALUES(?,?,?,?,?,?,?,?)',
        [revisionId, translation.id, next.slug, next.title, next.summary, next.markdown, next.coverId, JSON.stringify(next.metadata)])
      await db.execute('INSERT INTO revision_media(revision_id,media_id) SELECT ?,media_id FROM revision_media WHERE revision_id=?',
        [revisionId, change.before.publishedRevisionId])
      const [updated] = await db.execute('UPDATE content_translations SET draft_revision_id=?,published_revision_id=?,version=version+2 WHERE id=? AND version=?',
        [revisionId, revisionId, translation.id, change.before.version])
      assert.equal(updated.affectedRows, 1)
      await db.execute('UPDATE content_items SET updated_at=UTC_TIMESTAMP(3) WHERE id=?', [change.id])
      published.push({ id: change.id, slug: change.slug, previousRevisionId: change.before.publishedRevisionId, revisionId })
    }
    const [afterRows] = await db.query(selectPublished)
    assert.equal(afterRows.length, before.length)
    for (const row of afterRows.map(normalize)) {
      const change = changes.find(c => c.id === row.id && c.locale === row.locale)
      if (!change) { assert.deepEqual(row, byId.get(`${row.id}:${row.locale}`)); continue }
      const revision = published.find(p => p.id === row.id)
      assert.deepEqual(row, { ...change.after, version: change.before.version + 2,
        draftRevisionId: revision.revisionId, publishedRevisionId: revision.revisionId })
      const [oldMedia] = await db.execute('SELECT media_id FROM revision_media WHERE revision_id=? ORDER BY media_id', [revision.previousRevisionId])
      const [newMedia] = await db.execute('SELECT media_id FROM revision_media WHERE revision_id=? ORDER BY media_id', [revision.revisionId])
      assert.deepEqual(newMedia, oldMedia, `Media links: ${change.slug}`)
    }
    const [[afterCounts]] = await db.query('SELECT COUNT(*) AS revisions FROM content_revisions')
    assert.equal(afterCounts.revisions, counts.revisions + changes.length)
    const [itemsAfter] = await db.query('SELECT id,kind,author_id,archived_at,created_at FROM content_items ORDER BY id')
    assert.deepEqual(itemsAfter, items)
    for (const table of protectedTables) {
      const [after] = await db.query(`SELECT * FROM ${table} ORDER BY 1`)
      assert.deepEqual(after, protectedBefore[table], `Preserve ${table}`)
    }
    await db.commit()
    await writeFile(new URL('publication-result.json', review), JSON.stringify({ appliedAt: new Date().toISOString(), backup,
      published, preserved: ['publication dates', 'authors', 'titles', 'covers', 'tags', 'pins', 'comments', 'journal', 'revision history'] }, null, 2))
    console.log('Published 64 copy revisions. Publication dates, authors, media, pins, comments and journal preserved.')
  }
} catch (error) { await db.rollback(); throw error }
finally { await db.end() }
