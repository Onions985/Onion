import { createHash, randomBytes } from 'node:crypto'
import { createError, getCookie, setCookie, deleteCookie, type H3Event } from 'h3'
import { query, execute } from './database'
export const digest = (value: string) => createHash('sha256').update(value).digest('hex')
export const secureCookie = () => process.env.COOKIE_SECURE === 'true'
export async function currentUser(event: H3Event) {
  const token = getCookie(event, 'onion_session')
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null
  const [user] = await query<{ id: string; email: string }>(
    'SELECT u.id, u.email FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>UTC_TIMESTAMP()',
    [digest(token)],
  )
  return user || null
}
export async function requireAdmin(event: H3Event) {
  const user = await currentUser(event)
  if (!user) throw createError({ statusCode: 401, statusMessage: 'AUTH_REQUIRED' })
  return user
}
export async function createSession(event: H3Event, userId: string) {
  const token = randomBytes(32).toString('hex')
  await execute('DELETE FROM sessions WHERE expires_at<UTC_TIMESTAMP()')
  await execute(
    'INSERT INTO sessions (token_hash,user_id,expires_at) VALUES (?,?,DATE_ADD(UTC_TIMESTAMP(),INTERVAL 14 DAY))',
    [digest(token), userId],
  )
  setCookie(event, 'onion_session', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: secureCookie(),
    path: '/',
    maxAge: 14 * 86400,
  })
}
export async function endSession(event: H3Event) {
  const token = getCookie(event, 'onion_session')
  if (token) await execute('DELETE FROM sessions WHERE token_hash=?', [digest(token)])
  deleteCookie(event, 'onion_session', { path: '/', secure: secureCookie() })
}
