import mysql from 'mysql2/promise'
import { readFile, readdir } from 'node:fs/promises'
import { createHash, randomUUID, randomBytes, scrypt as scryptCallback } from 'node:crypto'
import { promisify } from 'node:util'
import { config, profiles, messages, examples } from '../database/seed.mjs'

if (!process.env.DATABASE_URL) throw new Error('Set DATABASE_URL in .env first')
const url = new URL(process.env.DATABASE_URL)
const db = await mysql.createConnection({
  host: url.hostname,
  port: Number(url.port || 3306),
  user: decodeURIComponent(url.username),
  password: decodeURIComponent(url.password),
  database: url.pathname.slice(1),
  charset: 'utf8mb4',
  timezone: 'Z',
  ...(process.env.DATABASE_SSL === 'true' ? { ssl: {} } : {}),
})
try {
  const [[lock]] = await db.query("SELECT GET_LOCK('onion_schema_init',30) AS acquired")
  if (!lock.acquired) throw new Error('Another database initializer is running')
  await db.query(
    'CREATE TABLE IF NOT EXISTS schema_migrations (version VARCHAR(100) PRIMARY KEY,checksum CHAR(64) NOT NULL,applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)',
  )
  const directory = new URL('../database/migrations/', import.meta.url)
  for (const file of (await readdir(directory)).filter((name) => /^\d+_.+\.sql$/.test(name)).sort()) {
    const sql = await readFile(new URL(file, directory), 'utf8'),
      checksum = createHash('sha256').update(sql).digest('hex'),
      version = file.slice(0, -4)
    const [[previous]] = await db.execute('SELECT checksum FROM schema_migrations WHERE version=?', [version])
    if (previous && previous.checksum !== checksum)
      throw new Error(`Migration checksum changed: ${version}. Create a new migration instead.`)
    if (!previous) {
      for (const statement of sql
        .split(';')
        .map((s) => s.trim())
        .filter(Boolean))
        await db.query(statement)
      await db.execute('INSERT INTO schema_migrations(version,checksum) VALUES(?,?)', [version, checksum])
    }
  }
  await db.beginTransaction()
  await db.execute('INSERT IGNORE INTO site_settings(id,config) VALUES(1,?)', [JSON.stringify(config)])
  await db.execute(
    "UPDATE site_settings SET config=JSON_SET(config,'$.writingTags',CAST(? AS JSON)) WHERE id=1 AND JSON_CONTAINS_PATH(config,'one','$.writingTags')=0",
    [JSON.stringify(config.writingTags)],
  )
  for (const p of profiles)
    await db.execute(
      'INSERT IGNORE INTO site_profiles(locale,site_name,display_name,headline,description,motto,about_markdown,footer,quote) VALUES(?,?,?,?,?,?,?,?,?)',
      Object.values(p),
    )
  for (const m of messages)
    await db.execute('INSERT IGNORE INTO ui_messages(locale,message_key,value) VALUES(?,?,?)', [
      m.locale,
      m.key,
      m.value,
    ])
  const [[existing]] = await db.query('SELECT id FROM users LIMIT 1')
  if (!existing) {
    const email = process.env.ADMIN_EMAIL
    const password = process.env.ADMIN_PASSWORD
    if (!email || !password || password.length < 12 || password.includes('change-me'))
      throw new Error('Set ADMIN_EMAIL and a unique ADMIN_PASSWORD of at least 12 characters')
    const id = randomUUID(),
      salt = randomBytes(16).toString('hex'),
      hash = await promisify(scryptCallback)(password, salt, 64)
    await db.execute('INSERT INTO users(id,email,password_hash) VALUES(?,?,?)', [
      id,
      email.toLowerCase(),
      `scrypt:${salt}:${hash.toString('hex')}`,
    ])
    if (process.env.SEED_EXAMPLES === 'true')
      for (const example of examples) {
        const itemId = randomUUID()
        await db.execute('INSERT INTO content_items(id,kind,author_id) VALUES(?,?,?)', [
          itemId,
          example.kind,
          id,
        ])
        for (const locale of example.kind === 'blog' ? ['zh', 'en'] : ['zh']) {
          const translationId = randomUUID(),
            revisionId = randomUUID(),
            [title, summary, category] = example[locale]
          const metadata = {
            category,
            tags: [],
            projectUrl: '',
            repositoryUrl: '',
            projectStatus: '',
            technologies: [],
            occurredOn: '',
            location: '',
            featured: false,
            ...example.metadata,
          }
          await db.execute('INSERT INTO content_translations(id,content_id,locale) VALUES(?,?,?)', [
            translationId,
            itemId,
            locale,
          ])
          await db.execute(
            'INSERT INTO content_revisions(id,translation_id,slug,title,summary,markdown,metadata) VALUES(?,?,?,?,?,?,?)',
            [
              revisionId,
              translationId,
              example.slug,
              title,
              summary,
              example.markdown[locale],
              JSON.stringify(metadata),
            ],
          )
          await db.execute(
            'UPDATE content_translations SET draft_revision_id=?,published_revision_id=?,published_slug=?,version=1,published_at=UTC_TIMESTAMP(3) WHERE id=?',
            [revisionId, revisionId, example.slug, translationId],
          )
        }
      }
  }
  await db.commit()
  console.log('MySQL schema and initial data are ready. Existing content and accounts were preserved.')
} catch (e) {
  await db.rollback()
  throw e
} finally {
  await db.query("SELECT RELEASE_LOCK('onion_schema_init')")
  await db.end()
}
