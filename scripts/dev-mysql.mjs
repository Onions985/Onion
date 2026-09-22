// An isolated local instance. This never connects to, stops, or changes an installed MySQL service.
import { mkdir, readFile, writeFile, access } from 'node:fs/promises'
import { openSync } from 'node:fs'
import { resolve } from 'node:path'
import { execFile, spawn } from 'node:child_process'
import { promisify } from 'node:util'
import { randomBytes } from 'node:crypto'
import mysql from 'mysql2/promise'
const base = resolve('.runtime/mysql'),
  data = resolve(base, 'data'),
  port = Number(process.env.ONION_MYSQL_PORT || 3317)
const binary = process.env.MYSQLD_PATH || 'C:/Program Files/MySQL/MySQL Server 8.0/bin/mysqld.exe'
await access(binary)
await mkdir(base, { recursive: true })
let state
try {
  state = JSON.parse(await readFile(resolve(base, 'local-state.json'), 'utf8'))
} catch {}
const fresh = !state
if (fresh) {
  try {
    await access('.env')
    throw new Error(
      'A .env already exists. Configure its MySQL explicitly; local setup will not overwrite it.',
    )
  } catch (e) {
    if (e.code !== 'ENOENT') throw e
  }
  state = {
    port,
    rootPassword: randomBytes(24).toString('hex'),
    appPassword: randomBytes(24).toString('hex'),
    adminPassword: randomBytes(18).toString('base64url'),
  }
  await promisify(execFile)(
    binary,
    ['--no-defaults', '--initialize-insecure', `--datadir=${data}`, '--console'],
    { windowsHide: true, maxBuffer: 1024 * 1024 },
  )
  await writeFile(resolve(base, 'local-state.json'), JSON.stringify(state), { flag: 'wx' })
}
let db
try {
  db = await mysql.createConnection({
    host: '127.0.0.1',
    port: state.port,
    user: 'root',
    password: fresh ? '' : state.rootPassword,
    connectTimeout: 2000,
  })
} catch {
  const output = openSync(resolve(base, 'server.log'), 'a')
  const child = spawn(
    binary,
    [
      '--no-defaults',
      `--datadir=${data}`,
      `--port=${state.port}`,
      '--bind-address=127.0.0.1',
      '--mysqlx=0',
      '--skip-log-bin',
      `--pid-file=${resolve(base, 'server.pid')}`,
      '--console',
    ],
    { windowsHide: true, detached: true, stdio: ['ignore', output, output] },
  )
  child.unref()
  for (let i = 0; i < 60; i++) {
    try {
      db = await mysql.createConnection({
        host: '127.0.0.1',
        port: state.port,
        user: 'root',
        password: fresh ? '' : state.rootPassword,
        connectTimeout: 1000,
      })
      break
    } catch {
      await new Promise((r) => setTimeout(r, 500))
    }
  }
}
if (!db) throw new Error('Local MySQL did not start. See .runtime/mysql/server.log')
try {
  if (fresh) {
    await db.query("ALTER USER 'root'@'localhost' IDENTIFIED BY ?", [state.rootPassword])
    for (const name of ['onion', 'onion_test'])
      await db.query(`CREATE DATABASE IF NOT EXISTS ${name} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`)
    await db.query("CREATE USER 'onion'@'127.0.0.1' IDENTIFIED BY ?", [state.appPassword])
    for (const name of ['onion', 'onion_test'])
      await db.query(`GRANT ALL PRIVILEGES ON ${name}.* TO 'onion'@'127.0.0.1'`)
    await writeFile(
      '.env',
      `DATABASE_URL=mysql://onion:${state.appPassword}@127.0.0.1:${state.port}/onion\nUPLOAD_DIR=./data/uploads\nSITE_URL=http://localhost:3000\nCOOKIE_SECURE=false\nADMIN_EMAIL=admin@onion.local\nADMIN_PASSWORD=${state.adminPassword}\nSEED_EXAMPLES=false\n`,
      { flag: 'wx' },
    )
  }
  console.log(
    `Isolated project MySQL is ready on 127.0.0.1:${state.port}. Local credentials are in .env (not printed).`,
  )
} finally {
  await db.end()
}
