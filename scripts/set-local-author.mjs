import mysql from 'mysql2/promise'
import { readFile, writeFile } from 'node:fs/promises'
import { hashPassword, verifyPassword } from '../server/utils/password.ts'

// 凭据从标准输入读取，避免写入脚本或作为进程参数留存。
let input = ''
for await (const chunk of process.stdin) input += chunk
const { email, password } = JSON.parse(input)
if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    typeof password !== 'string' || !password.length || password.length > 512) throw new Error('Invalid account input')
const url = new URL(process.env.DATABASE_URL)
if (url.hostname !== '127.0.0.1' || url.port !== '3317' || url.pathname !== '/onion') throw new Error('Local Onion only')
const db = await mysql.createConnection({ host: url.hostname, port: +url.port, user: decodeURIComponent(url.username), password: decodeURIComponent(url.password), database: 'onion' })
try {
  const [users] = await db.query('SELECT id,email FROM users')
  if (users.length !== 1 || !['admin@onion.local', email.toLowerCase()].includes(users[0].email)) throw new Error('Unexpected author accounts; no changes made')
  const hash = await hashPassword(password)
  if (!await verifyPassword(password, hash)) throw new Error('Password verification failed')
  await db.beginTransaction()
  await db.execute('UPDATE users SET email=?,password_hash=? WHERE id=?', [email.toLowerCase(), hash, users[0].id])
  await db.execute('DELETE FROM sessions WHERE user_id=?', [users[0].id])
  await db.commit()
  // 沿用作者 ID，所有现有内容、图片与作者评论继续属于同一人。
  const envFile = new URL('../.env', import.meta.url)
  let env = await readFile(envFile, 'utf8')
  for (const [key, value] of Object.entries({ ADMIN_EMAIL: email.toLowerCase(), ADMIN_PASSWORD: password })) {
    const line = `${key}=${JSON.stringify(value)}`
    const pattern = new RegExp(`^${key}=.*$`, 'm')
    env = pattern.test(env) ? env.replace(pattern, () => line) : `${env.trimEnd()}\n${line}\n`
  }
  await writeFile(envFile, env)
  const [[count]] = await db.execute('SELECT COUNT(*) AS total FROM content_items WHERE author_id=?', [users[0].id])
  console.log(JSON.stringify({ accountReady: true, authorIdPreserved: true, ownedContent: count.total }))
} catch (error) {
  await db.rollback()
  throw error
} finally { await db.end() }
