import mysql from 'mysql2/promise'
import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import assert from 'node:assert/strict'
const url = new URL(process.env.DATABASE_URL)
assert(
  url.hostname === '127.0.0.1' && url.port === '3317' && url.pathname === '/onion',
  'Only local Onion is allowed',
)
const db = await mysql.createConnection({
  host: url.hostname,
  port: +url.port,
  user: decodeURIComponent(url.username),
  password: decodeURIComponent(url.password),
  database: 'onion',
})
try {
  const [versions] = await db.query('SELECT version,checksum FROM schema_migrations ORDER BY version')
  const [[table]] = await db.query(
    "SELECT COUNT(*) AS present FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='content_pins'",
  )
  console.log(
    JSON.stringify({
      database: 'onion',
      port: 3317,
      versions: versions.map((v) => v.version),
      pinsTableExists: !!table.present,
    }),
  )
  if (!process.argv.includes('--apply')) process.exitCode = 0
  else {
    for (const name of ['001_initial', '002_comments', '003_translation_copy']) {
      const sql = await readFile(`database/migrations/${name}.sql`, 'utf8')
      assert.equal(
        versions.find((row) => row.version === name)?.checksum,
        createHash('sha256').update(sql).digest('hex'),
        `Verify predecessor ${name}`,
      )
    }
    const version = '004_content_pins',
      sql = await readFile(`database/migrations/${version}.sql`, 'utf8'),
      checksum = createHash('sha256').update(sql).digest('hex')
    const [[lock]] = await db.query("SELECT GET_LOCK('onion_schema_init',30) AS acquired")
    assert(lock.acquired)
    const [[existing]] = await db.execute('SELECT checksum FROM schema_migrations WHERE version=?', [version])
    if (existing) assert.equal(existing.checksum, checksum)
    else {
      await db.query(sql)
      await db.execute('INSERT INTO schema_migrations(version,checksum) VALUES(?,?)', [version, checksum])
    }
    const [columns] = await db.query('SHOW COLUMNS FROM content_pins')
    assert.deepEqual(
      columns.map((row) => row.Field),
      ['kind', 'content_id', 'updated_at'],
    )
    console.log('004_content_pins applied and verified; existing content was preserved.')
  }
} finally {
  await db.query("SELECT RELEASE_LOCK('onion_schema_init')")
  await db.end()
}
