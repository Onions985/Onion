import { spawn } from 'node:child_process'
import { mkdir, open } from 'node:fs/promises'
import { randomUUID, randomBytes } from 'node:crypto'
import mysql from 'mysql2/promise'
import { hashPassword } from '../server/utils/password.ts'
if (!process.env.DATABASE_URL) throw new Error('Configure .env first')
const source = new URL(process.env.DATABASE_URL),
  target = new URL(process.env.TEST_DATABASE_URL || process.env.DATABASE_URL)
if (!process.env.TEST_DATABASE_URL) target.pathname = '/onion_test'
if (target.pathname === source.pathname || !target.pathname.endsWith('_test'))
  throw new Error('Integration tests require a separate database ending in _test')
const port = Number(process.env.TEST_PORT || 3001),
  base = `http://127.0.0.1:${port}`
const env = {
  ...process.env,
  DATABASE_URL: target.toString(),
  UPLOAD_DIR: './.runtime/test-uploads',
  SITE_URL: base,
  HOST: '127.0.0.1',
  PORT: String(port),
  TEST_BASE_URL: base,
  SEED_EXAMPLES: 'true',
  COOKIE_SECURE: 'false',
  ADMIN_EMAIL: `integration-${randomUUID()}@onion.test`,
  ADMIN_PASSWORD: randomBytes(24).toString('base64url'),
}
function run(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, { env, stdio: 'inherit', windowsHide: true })
    child.on('error', reject)
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`Command exited ${code}`))))
  })
}
await run(['scripts/db-init.mjs'])
// A reused test database may have a different administrator than the local site.
// Create a test-only author instead of changing any existing account.
const db = await mysql.createConnection({
  host: target.hostname,
  port: Number(target.port || 3306),
  user: decodeURIComponent(target.username),
  password: decodeURIComponent(target.password),
  database: target.pathname.slice(1),
})
try {
  await db.execute('INSERT IGNORE INTO users(id,email,password_hash) VALUES(?,?,?)', [
    randomUUID(),
    env.ADMIN_EMAIL,
    await hashPassword(env.ADMIN_PASSWORD),
  ])
} finally {
  await db.end()
}
await mkdir('.runtime', { recursive: true })
const log = await open('.runtime/integration-server.log', 'w')
const server = spawn(process.execPath, ['.output/server/index.mjs'], {
  env,
  windowsHide: true,
  stdio: ['ignore', log.fd, log.fd],
})
try {
  let ready = false
  for (let i = 0; i < 80; i++) {
    if (server.exitCode !== null) throw new Error('Test server exited; see .runtime/integration-server.log')
    try {
      const response = await fetch(`${base}/api/health`)
      if (response.ok) {
        ready = true
        break
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 250))
  }
  if (!ready) throw new Error('Test server did not become healthy')
  // Suites share an author, rate-limit records and settings; serialize their mutations.
  await run([
    '--import',
    'tsx',
    '--test',
    '--test-concurrency=1',
    'tests/integration.test.ts',
    'tests/blog-tags.test.ts',
    'tests/moments.test.ts',
    'tests/project-flagship.test.ts',
    'tests/admin-content.test.ts',
    'tests/admin-comments.test.ts',
  ])
  // These checks change shared site settings; run after the existing suites restore theirs.
  await run(['--import', 'tsx', '--test', 'tests/discovery-integration.test.ts'])
} finally {
  server.kill()
  await log.close()
}
