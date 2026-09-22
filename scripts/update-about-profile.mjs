import mysql from 'mysql2/promise'
import { mkdir, writeFile } from 'node:fs/promises'
import { aboutMessages, aboutProfiles } from '../database/about-profile.mjs'

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
  const [profiles] = await db.query(
    'SELECT locale,about_markdown FROM site_profiles WHERE locale IN (?,?) FOR UPDATE',
    ['zh', 'en'],
  )
  if (profiles.length !== 2) throw Error('Both existing site profiles are required')
  const keys = [...new Set(aboutMessages.map((message) => message.key))]
  const [messages] = await db.query(
    `SELECT * FROM ui_messages WHERE message_key IN (${keys.map(() => '?').join(',')}) FOR UPDATE`,
    keys,
  )
  await mkdir('.runtime/about-profile', { recursive: true })
  await writeFile(
    `.runtime/about-profile/before-${Date.now()}.json`,
    JSON.stringify({ profiles, messages }, null, 2),
  )
  for (const [locale, markdown] of Object.entries(aboutProfiles))
    await db.execute('UPDATE site_profiles SET about_markdown=? WHERE locale=?', [markdown, locale])
  for (const message of aboutMessages)
    await db.execute(
      'INSERT INTO ui_messages(locale,message_key,value) VALUES(?,?,?) ON DUPLICATE KEY UPDATE value=?',
      [message.locale, message.key, message.value, message.value],
    )
  await db.commit()
  console.log(
    `Updated Chinese and English biographies and ${aboutMessages.length} UI messages; previous values backed up.`,
  )
} catch (error) {
  await db.rollback()
  throw error
} finally {
  await db.end()
}
