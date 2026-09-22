import { randomBytes } from 'node:crypto'
import { z } from 'zod'
import {
  defineEventHandler,
  getQuery,
  getMethod,
  getCookie,
  setCookie,
  createError,
  getRouterParam,
} from 'h3'
import {
  localeSchema,
  kindSchema,
  themeSchema,
  draftSchema,
  publishSchema,
  profileSchema,
  configSchema,
} from '../../shared/validation'
import { query, execute, jsonValue, transaction } from '../utils/database'
import { renderMarkdown, imageReferences } from '../utils/markdown'
import { readJson } from '../utils/request'
import { requireAdmin, currentUser, createSession, endSession, digest, secureCookie } from '../utils/auth'
import { verifyPassword } from '../utils/password'
import {
  publicContent,
  publicSearch,
  publicNavigation,
  publicBlogTags,
  publicDetail,
  adminDetail,
  createContent,
  saveContent,
  publishContent,
  pinContent,
  validateMedia,
} from '../utils/content'
import { uploadImage, serveImage } from '../utils/media'
import type { SiteConfig, SiteProfile } from '../../shared/types'
import { commentSchema, listComments, addComment, adminComments } from '../utils/comments'
import { clientIp } from '../utils/client-ip'

const profileColumns =
  'locale,site_name AS siteName,display_name AS displayName,headline,description,motto,about_markdown AS aboutMarkdown,footer,quote'
const settingsSchema = z.object({
  config: configSchema,
  profiles: z
    .array(profileSchema)
    .length(2)
    .refine((p) => new Set(p.map((v) => v.locale)).size === 2),
})
export default defineEventHandler(async (event) => {
  const path = (getRouterParam(event, 'path') || '').split('/').filter(Boolean),
    route = path.join('/'),
    method = getMethod(event),
    params = getQuery(event)
  const locale = localeSchema.safeParse(params.locale).data || 'zh'
  if (route === 'health' && method === 'GET') {
    await query('SELECT 1')
    return { ok: true }
  }
  if (route === 'site' && method === 'GET') {
    const [row] = await query<{ config: unknown }>('SELECT config FROM site_settings WHERE id=1')
    if (!row) throw createError({ statusCode: 503, statusMessage: 'DATABASE_NOT_INITIALIZED' })
    const config = jsonValue<SiteConfig>(row.config)
    const [profile] = await query<SiteProfile>(`SELECT ${profileColumns} FROM site_profiles WHERE locale=?`, [
      locale,
    ])
    const rows = await query<{ key: string; value: string }>(
      'SELECT message_key AS `key`,value FROM ui_messages WHERE locale=?',
      [locale],
    )
    const token = getCookie(event, 'onion_visitor')
    const [preference] = token
      ? await query<{ locale: string; theme: string }>('SELECT locale,theme FROM preferences WHERE id=?', [
          digest(token),
        ])
      : []
    return {
      config,
      profile,
      messages: Object.fromEntries(rows.map((r) => [r.key, r.value])),
      aboutHtml: renderMarkdown(profile?.aboutMarkdown || ''),
      preference: preference || { locale: config.defaultLocale, theme: config.defaultTheme },
    }
  }
  if (route === 'navigation' && method === 'GET') return publicNavigation(locale)
  if (route === 'search' && method === 'GET')
    return publicSearch(
      locale,
      String(params.q || '')
        .trim()
        .slice(0, 200),
      kindSchema.safeParse(params.kind).data,
      Math.floor(Math.max(1, Math.min(10000, Number(params.page) || 1))),
    )
  if (route === 'content' && method === 'GET')
    return publicContent(
      locale,
      kindSchema.safeParse(params.kind).data,
      String(params.q || '').slice(0, 200),
      Math.floor(Math.max(1, Math.min(10000, Number(params.page) || 1))),
      params.featured === 'true',
      typeof params.tag === 'string' ? params.tag.trim().slice(0, 40) : '',
    )
  if (route === 'blog-tags' && method === 'GET') return publicBlogTags(locale)
  if (path[0] === 'content' && path.length === 2 && method === 'GET')
    return publicDetail(locale, kindSchema.parse(params.kind), decodeURIComponent(path[1]!))
  if (route === 'preferences' && method === 'PUT') {
    const body = await readJson(event, z.object({ locale: localeSchema, theme: themeSchema }))
    const saved = getCookie(event, 'onion_visitor'),
      token = saved && /^[a-f0-9]{64}$/.test(saved) ? saved : randomBytes(32).toString('hex')
    await execute(
      'INSERT INTO preferences(id,locale,theme) VALUES(?,?,?) ON DUPLICATE KEY UPDATE locale=VALUES(locale),theme=VALUES(theme)',
      [digest(token), body.locale, body.theme],
    )
    const options = { path: '/', sameSite: 'lax' as const, secure: secureCookie(), maxAge: 365 * 86400 }
    setCookie(event, 'onion_visitor', token, { ...options, httpOnly: true })
    setCookie(event, 'onion_locale', body.locale, options)
    setCookie(event, 'onion_theme', body.theme, options)
    return { ok: true, ...body }
  }
  if (path[0] === 'media' && path.length === 2 && method === 'GET') return serveImage(event, path[1]!)
  if (route === 'comments' && method === 'GET') {
    const parsed = z.uuid().safeParse(params.contentId)
    if (!parsed.success) throw createError({ statusCode: 422, statusMessage: 'VALIDATION_ERROR' })
    return listComments(parsed.data, Math.floor(Math.max(1, Math.min(10000, Number(params.page) || 1))))
  }
  if (route === 'comments' && method === 'POST')
    return addComment(event, await readJson(event, commentSchema))
  if (route === 'auth/me' && method === 'GET') return { user: await currentUser(event) }
  if (route === 'auth/logout' && method === 'POST') {
    await endSession(event)
    return { ok: true }
  }
  if (route === 'auth/login' && method === 'POST') {
    const body = await readJson(
      event,
      z.object({ email: z.email().max(254), password: z.string().min(1).max(512) }),
    )
    const ip = digest(clientIp(event))
    await execute('DELETE FROM auth_attempts WHERE window_started<DATE_SUB(UTC_TIMESTAMP(),INTERVAL 1 DAY)')
    await execute(
      'INSERT INTO auth_attempts(ip_hash,attempts,window_started) VALUES(?,1,UTC_TIMESTAMP()) ON DUPLICATE KEY UPDATE attempts=IF(window_started<DATE_SUB(UTC_TIMESTAMP(),INTERVAL 15 MINUTE),1,attempts+1),window_started=IF(window_started<DATE_SUB(UTC_TIMESTAMP(),INTERVAL 15 MINUTE),UTC_TIMESTAMP(),window_started)',
      [ip],
    )
    const [attempt] = await query<{ attempts: number }>(
      'SELECT attempts FROM auth_attempts WHERE ip_hash=?',
      [ip],
    )
    if (attempt!.attempts > 10) throw createError({ statusCode: 429, statusMessage: 'RATE_LIMITED' })
    const [user] = await query<{ id: string; email: string; passwordHash: string }>(
      'SELECT id,email,password_hash AS passwordHash FROM users WHERE email=?',
      [body.email.toLowerCase()],
    )
    const valid = await verifyPassword(
      body.password,
      user?.passwordHash || `scrypt:${'0'.repeat(32)}:${'0'.repeat(128)}`,
    )
    if (!user || !valid) throw createError({ statusCode: 401, statusMessage: 'INVALID_CREDENTIALS' })
    await execute('DELETE FROM auth_attempts WHERE ip_hash=?', [ip])
    await endSession(event)
    await createSession(event, user.id)
    return { user: { id: user.id, email: user.email } }
  }
  if (path[0] === 'admin') {
    const user = await requireAdmin(event)
    if (route === 'admin/comments' && method === 'GET')
      return adminComments(
        z.enum(['pending', 'approved', 'hidden', '']).safeParse(params.status).data || '',
        Math.floor(Math.max(1, Math.min(10000, Number(params.page) || 1))),
      )
    if (path[1] === 'comments' && path.length === 3 && method === 'PUT') {
      const body = await readJson(event, z.object({ status: z.enum(['pending', 'approved', 'hidden']) })),
        id = z.uuid().parse(path[2])
      const result = await execute('UPDATE comments SET status=? WHERE id=?', [body.status, id])
      if (!result.affectedRows) throw createError({ statusCode: 404, statusMessage: 'COMMENT_NOT_FOUND' })
      return { ok: true }
    }
    if (path[1] === 'comments' && path[3] === 'reply' && method === 'POST') {
      const body = await readJson(event, z.object({ body: z.string().trim().min(1).max(2000) }))
      const [parent] = await query<{ id: string; contentId: string; parentId: string | null }>(
        "SELECT id,content_id AS contentId,parent_id AS parentId FROM comments WHERE id=? AND status='approved'",
        [path[2]!],
      )
      if (!parent) throw createError({ statusCode: 422, statusMessage: 'COMMENT_PARENT_INVALID' })
      return addComment(event, {
        contentId: parent.contentId,
        parentId: parent.parentId || parent.id,
        authorName: user.email,
        body: body.body,
      })
    }
    if (route === 'admin/preview' && method === 'POST') {
      const body = await readJson(event, z.object({ markdown: z.string().max(200000) }))
      return { html: renderMarkdown(body.markdown) }
    }
    if (route === 'admin/site' && method === 'GET') {
      const [row] = await query<{ config: unknown }>('SELECT config FROM site_settings WHERE id=1')
      return {
        config: jsonValue<SiteConfig>(row!.config),
        profiles: await query<SiteProfile>(
          `SELECT ${profileColumns} FROM site_profiles ORDER BY locale DESC`,
        ),
      }
    }
    if (route === 'admin/site' && method === 'PUT') {
      const body = await readJson(event, settingsSchema)
      await validateMedia([
        ...new Set([
          ...(body.config.avatarId ? [body.config.avatarId] : []),
          ...body.profiles.flatMap((p) => imageReferences(p.aboutMarkdown)),
        ]),
      ])
      await transaction(async (c) => {
        await execute('UPDATE site_settings SET config=? WHERE id=1', [JSON.stringify(body.config)], c)
        for (const p of body.profiles)
          await execute(
            'UPDATE site_profiles SET site_name=?,display_name=?,headline=?,description=?,motto=?,about_markdown=?,footer=?,quote=? WHERE locale=?',
            [
              p.siteName,
              p.displayName,
              p.headline,
              p.description,
              p.motto,
              p.aboutMarkdown,
              p.footer,
              p.quote,
              p.locale,
            ],
            c,
          )
      })
      return { ok: true }
    }
    if (route === 'admin/media' && method === 'POST') return uploadImage(event, user.id)
    if (route === 'admin/media' && method === 'GET')
      return {
        items: await query(
          "SELECT id,original_name AS originalName,mime_type AS mimeType,size,width,height,created_at AS createdAt,CONCAT('/api/media/',id) AS url FROM media_assets ORDER BY created_at DESC LIMIT 200",
        ),
      }
    if (route === 'admin/content' && method === 'GET') {
      const rows = await query<{ id: string }>(
        'SELECT id FROM content_items WHERE archived_at IS NULL ORDER BY updated_at DESC LIMIT 200',
      )
      return { items: await Promise.all(rows.map((r) => adminDetail(r.id))) }
    }
    if (route === 'admin/content' && method === 'POST') {
      const { kind, ...body } = await readJson(event, draftSchema.extend({ kind: kindSchema }))
      return createContent(user.id, kind, body)
    }
    if (path[1] === 'content' && path[2]) {
      const id = z.uuid().parse(path[2])
      if (path.length === 3 && method === 'GET') return adminDetail(id)
      if (path.length === 4 && path[3] === 'pin' && method === 'PUT') {
        const body = await readJson(event, z.object({ pinned: z.boolean() }))
        return pinContent(id, body.pinned)
      }
      if (path.length === 3 && method === 'DELETE') {
        const result = await execute(
          'UPDATE content_items SET archived_at=UTC_TIMESTAMP(3) WHERE id=? AND archived_at IS NULL',
          [id],
        )
        if (!result.affectedRows) throw createError({ statusCode: 404, statusMessage: 'CONTENT_NOT_FOUND' })
        return { ok: true }
      }
      if (path[3] === 'draft' && method === 'PUT') return saveContent(id, await readJson(event, draftSchema))
      if (['publish', 'unpublish'].includes(path[3] || '') && method === 'POST') {
        const body = await readJson(event, publishSchema)
        return publishContent(id, body.locale, body.expectedVersion, path[3] === 'publish')
      }
    }
  }
  throw createError({ statusCode: 404, statusMessage: 'NOT_FOUND' })
})
