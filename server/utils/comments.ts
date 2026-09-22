import { randomUUID, createHmac, randomBytes } from 'node:crypto'
import { createError, type H3Event } from 'h3'
import { query, execute } from './database'
import { currentUser } from './auth'
import { z } from 'zod'
import { clientIp } from './client-ip'
export const commentSchema = z.object({
  contentId: z.uuid(),
  parentId: z.uuid().nullable().default(null),
  authorName: z.string().trim().min(1).max(40),
  body: z.string().trim().min(1).max(2000),
})
const secret =
  process.env.COMMENT_HASH_SECRET || process.env.ADMIN_PASSWORD || randomBytes(32).toString('hex')
const columns =
  'id,content_id AS contentId,parent_id AS parentId,author_name AS authorName,body,is_author AS isAuthor,status,created_at AS createdAt'
async function requirePublished(contentId: string) {
  const [item] = await query(
    'SELECT c.id FROM content_items c JOIN content_translations t ON t.content_id=c.id WHERE c.id=? AND c.archived_at IS NULL AND t.published_revision_id IS NOT NULL LIMIT 1',
    [contentId],
  )
  if (!item) throw createError({ statusCode: 404, statusMessage: 'CONTENT_NOT_FOUND' })
}
export async function listComments(contentId: string, page = 1) {
  await requirePublished(contentId)
  const [{ total } = { total: 0 }] = await query<{ total: number }>(
    "SELECT COUNT(*) AS total FROM comments WHERE content_id=? AND parent_id IS NULL AND status='approved'",
    [contentId],
  )
  const roots = await query<{ id: string } & Record<string, any>>(
    `SELECT ${columns} FROM comments WHERE content_id=? AND parent_id IS NULL AND status='approved' ORDER BY created_at DESC,id LIMIT 20 OFFSET ${(page - 1) * 20}`,
    [contentId],
  )
  const replies = roots.length
    ? await query(
        `SELECT ${columns} FROM comments WHERE content_id=? AND status='approved' AND parent_id IN (${roots.map(() => '?').join(',')}) ORDER BY created_at,id`,
        [contentId, ...roots.map((r) => r.id)],
      )
    : []
  return { items: [...roots, ...replies], total: Number(total), page, pageSize: 20 }
}
export async function addComment(event: H3Event, body: z.infer<typeof commentSchema>) {
  await requirePublished(body.contentId)
  const user = await currentUser(event)
  if (body.parentId) {
    const [parent] = await query(
      "SELECT id FROM comments WHERE id=? AND content_id=? AND parent_id IS NULL AND status='approved'",
      [body.parentId, body.contentId],
    )
    if (!parent) throw createError({ statusCode: 422, statusMessage: 'COMMENT_PARENT_INVALID' })
  }
  if (!user) {
    const ip = createHmac('sha256', secret).update(clientIp(event)).digest('hex')
    await execute(
      'DELETE FROM comment_attempts WHERE window_started<DATE_SUB(UTC_TIMESTAMP(),INTERVAL 1 DAY)',
    )
    await execute(
      'INSERT INTO comment_attempts(ip_hash,attempts,window_started) VALUES(?,1,UTC_TIMESTAMP()) ON DUPLICATE KEY UPDATE attempts=IF(window_started<DATE_SUB(UTC_TIMESTAMP(),INTERVAL 10 MINUTE),1,attempts+1),window_started=IF(window_started<DATE_SUB(UTC_TIMESTAMP(),INTERVAL 10 MINUTE),UTC_TIMESTAMP(),window_started)',
      [ip],
    )
    const [rate] = await query<{ attempts: number }>(
      'SELECT attempts FROM comment_attempts WHERE ip_hash=?',
      [ip],
    )
    if (rate!.attempts > 5) throw createError({ statusCode: 429, statusMessage: 'COMMENT_RATE_LIMITED' })
  }
  const id = randomUUID()
  let name = body.authorName
  if (user) {
    const [profile] = await query<{ name: string }>(
      "SELECT display_name AS name FROM site_profiles WHERE locale='zh'",
    )
    name = profile?.name || name
  }
  await execute(
    'INSERT INTO comments(id,content_id,parent_id,author_name,body,is_author,status) VALUES(?,?,?,?,?,?,?)',
    [
      id,
      body.contentId,
      body.parentId,
      name.slice(0, 40),
      body.body,
      Boolean(user),
      user ? 'approved' : 'pending',
    ],
  )
  return { id, status: user ? 'approved' : 'pending' }
}
export async function adminComments(status: string, page = 1) {
  const where = status ? ' AND m.status=?' : '',
    args = status ? [status] : []
  const [count] = await query<{ total: number }>(
    `SELECT COUNT(*) AS total FROM comments m JOIN content_items c ON c.id=m.content_id WHERE c.archived_at IS NULL${where}`,
    args,
  )
  const items = await query(
    `SELECT m.id,m.content_id AS contentId,m.parent_id AS parentId,m.author_name AS authorName,m.body,m.is_author AS isAuthor,m.status,m.created_at AS createdAt,c.kind,(SELECT r.title FROM content_translations t JOIN content_revisions r ON r.id=t.draft_revision_id WHERE t.content_id=c.id ORDER BY (t.locale='zh') DESC LIMIT 1) AS contentTitle FROM comments m JOIN content_items c ON c.id=m.content_id WHERE c.archived_at IS NULL${where} ORDER BY m.created_at DESC,m.id LIMIT 30 OFFSET ${(page - 1) * 30}`,
    args,
  )
  return { items, total: Number(count?.total || 0), page, pageSize: 30 }
}
