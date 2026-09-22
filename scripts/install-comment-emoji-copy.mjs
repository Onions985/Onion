import mysql from 'mysql2/promise'
import { mkdir, writeFile } from 'node:fs/promises'
import { commentEmojiMessages } from '../database/comment-emoji-messages.mjs'

const url = new URL(process.env.DATABASE_URL)
if (url.hostname !== '127.0.0.1' || url.port !== '3317' || url.pathname !== '/onion')
  throw Error('Local Onion database only')
const db = await mysql.createConnection({
  host: url.hostname,
  port: +url.port,
  user: decodeURIComponent(url.username),
  password: decodeURIComponent(url.password),
  database: 'onion',
  charset: 'utf8mb4',
})
try {
  await db.beginTransaction()
  const keys = [...new Set(commentEmojiMessages.map((message) => message.key))]
  const [before] = await db.query(
    `SELECT * FROM ui_messages WHERE message_key IN (${keys.map(() => '?').join(',')}) FOR UPDATE`,
    keys,
  )
  await mkdir('.runtime/comment-emoji', { recursive: true })
  await writeFile(`.runtime/comment-emoji/ui-copy-before-${Date.now()}.json`, JSON.stringify(before, null, 2))
  let added = 0
  for (const message of commentEmojiMessages) {
    const [result] = await db.execute(
      'INSERT IGNORE INTO ui_messages(locale,message_key,value) VALUES(?,?,?)',
      [message.locale, message.key, message.value],
    )
    added += result.affectedRows
  }
  await db.commit()
  console.log(`Added ${added} Chinese/English UI messages; existing messages preserved.`)
} catch (error) {
  await db.rollback()
  throw error
} finally {
  await db.end()
}
