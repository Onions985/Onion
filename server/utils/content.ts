import { randomUUID } from 'node:crypto'
import { createError } from 'h3'
import type { PoolConnection } from 'mysql2/promise'
import type { z } from 'zod'
import { draftSchema } from '../../shared/validation'
import { normalizeMomentDraft } from '../../shared/moment'
import type {
  AdminContent,
  BlogTags,
  ContentDetail,
  ContentMetadata,
  ContentSummary,
  Locale,
  SiteConfig,
  SearchResults,
  NavigationPreview,
} from '../../shared/types'
import { query, execute, transaction, jsonValue } from './database'
import { imageReferences, readingMinutes, renderMarkdown, markdownText } from './markdown'

type Row = Record<string, any>
const pinnedExpression =
  'EXISTS(SELECT 1 FROM content_pins pin WHERE pin.kind=c.kind AND pin.content_id=c.id)'
const selectPublished = `SELECT c.id,c.kind,${pinnedExpression} AS pinned,t.locale,t.published_at AS publishedAt,r.slug,r.title,r.summary,r.markdown,r.cover_id AS coverId,r.metadata FROM content_items c JOIN content_translations t ON t.content_id=c.id JOIN content_revisions r ON r.id=t.published_revision_id`
// A blog uses the requested published translation, then Chinese. Projects and life keep their original Chinese content.
const preferredTranslation = `t.id=(SELECT preferred.id FROM content_translations preferred WHERE preferred.content_id=c.id AND preferred.published_revision_id IS NOT NULL ORDER BY (preferred.locale=IF(c.kind='blog',?,'zh')) DESC,(preferred.locale='zh') DESC LIMIT 1)`
const searchCondition =
  "(r.title LIKE ? OR r.summary LIKE ? OR r.markdown LIKE ? OR JSON_UNQUOTE(JSON_EXTRACT(r.metadata,'$.tags')) LIKE ? OR JSON_UNQUOTE(JSON_EXTRACT(r.metadata,'$.technologies')) LIKE ? OR JSON_UNQUOTE(JSON_EXTRACT(r.metadata,'$.projectModules')) LIKE ?)"
const searchArguments = (q: string) => Array(6).fill(`%${q.replace(/[\\%_]/g, '\\$&')}%`)
function summary(row: Row): ContentSummary {
  return {
    ...row,
    pinned: Boolean(row.pinned),
    markdown: undefined,
    metadata: jsonValue<ContentMetadata>(row.metadata),
    readingMinutes: readingMinutes(row.markdown),
  } as unknown as ContentSummary
}
export async function publicContent(
  locale: Locale,
  kind?: string,
  q = '',
  page = 1,
  featured = false,
  tag = '',
) {
  const conditions = ['c.archived_at IS NULL', preferredTranslation],
    args: (string | number)[] = [locale]
  if (kind) {
    conditions.push('c.kind=?')
    args.push(kind)
  }
  if (featured) conditions.push(`(JSON_EXTRACT(r.metadata,'$.featured')=true OR ${pinnedExpression})`)
  if (tag) {
    conditions.push("JSON_CONTAINS(r.metadata,JSON_QUOTE(?),'$.tags')=1")
    args.push(tag)
  }
  if (q) {
    conditions.push(searchCondition)
    args.push(...searchArguments(q))
  }
  const where = ` WHERE ${conditions.join(' AND ')}`
  const [count] = await query<{ total: number }>(
    `SELECT COUNT(*) AS total FROM content_items c JOIN content_translations t ON t.content_id=c.id JOIN content_revisions r ON r.id=t.published_revision_id${where}`,
    args,
  )
  const rows = await query<Row>(
    `${selectPublished}${where} ORDER BY pinned DESC,t.published_at DESC,c.id LIMIT 12 OFFSET ${(page - 1) * 12}`,
    args,
  )
  return { items: rows.map(summary), total: Number(count?.total || 0), page, pageSize: 12 }
}
export async function publicSearch(
  locale: Locale,
  q: string,
  kind?: string,
  page = 1,
): Promise<SearchResults> {
  const [results, rows] = await Promise.all([
    publicContent(locale, kind, q, page),
    query<{ kind: 'blog' | 'project' | 'life'; total: number }>(
      `SELECT c.kind,COUNT(*) AS total FROM content_items c JOIN content_translations t ON t.content_id=c.id JOIN content_revisions r ON r.id=t.published_revision_id WHERE c.archived_at IS NULL AND ${preferredTranslation}${q ? ` AND ${searchCondition}` : ''} GROUP BY c.kind`,
      [locale, ...(q ? searchArguments(q) : [])],
    ),
  ])
  const counts = { all: 0, blog: 0, project: 0, life: 0 }
  for (const row of rows) {
    if (['blog', 'project', 'life'].includes(row.kind)) {
      counts[row.kind] = Number(row.total)
      counts.all += Number(row.total)
    }
  }
  return { ...results, counts }
}
export async function publicNavigation(locale: Locale): Promise<NavigationPreview> {
  const [blog, project, life, topics] = await Promise.all([
    publicContent(locale, 'blog'),
    publicContent(locale, 'project'),
    publicContent(locale, 'life'),
    publicBlogTags(locale),
  ])
  return {
    sections: {
      blog: { items: blog.items.slice(0, 3), total: blog.total },
      project: { items: project.items.slice(0, 3), total: project.total },
      life: { items: life.items.slice(0, 3), total: life.total },
    },
    tags: topics.tags.filter((tag) => tag.count > 0).slice(0, 4),
  }
}
export async function publicBlogTags(locale: Locale): Promise<BlogTags> {
  const where = ` WHERE c.archived_at IS NULL AND c.kind='blog' AND ${preferredTranslation}`
  const joins =
    ' FROM content_items c JOIN content_translations t ON t.content_id=c.id JOIN content_revisions r ON r.id=t.published_revision_id'
  const [counts, totals, settings] = await Promise.all([
    query<{ name: string; count: number }>(
      `SELECT tags.name,COUNT(DISTINCT c.id) AS count${joins} JOIN JSON_TABLE(r.metadata,'$.tags[*]' COLUMNS(name VARCHAR(40) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin PATH '$')) tags${where} GROUP BY tags.name ORDER BY count DESC,tags.name`,
      [locale],
    ),
    query<{ total: number }>(`SELECT COUNT(*) AS total${joins}${where}`, [locale]),
    query<{ config: unknown }>('SELECT config FROM site_settings WHERE id=1'),
  ])
  const configured = jsonValue<SiteConfig>(settings[0]?.config)?.writingTags || []
  const tags = new Map(configured.map((name) => [name, 0]))
  for (const row of counts) tags.set(row.name, Number(row.count))
  return {
    tags: [...tags]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, locale)),
    total: Number(totals[0]?.total || 0),
  }
}
export async function publicDetail(locale: Locale, kind: string, slug: string): Promise<ContentDetail> {
  const [row] = await query<Row>(
    `${selectPublished} WHERE c.archived_at IS NULL AND ${preferredTranslation} AND c.kind=? AND EXISTS(SELECT 1 FROM content_translations alias WHERE alias.content_id=c.id AND alias.published_revision_id IS NOT NULL AND alias.published_slug=?)`,
    [locale, kind, slug],
  )
  if (!row) throw createError({ statusCode: 404, statusMessage: 'CONTENT_NOT_FOUND' })
  const translations = await query<{ locale: Locale; slug: string }>(
    'SELECT locale,published_slug AS slug FROM content_translations WHERE content_id=? AND published_revision_id IS NOT NULL',
    [row.id],
  )
  return { ...summary(row), html: renderMarkdown(row.markdown), translations }
}
export async function adminDetail(id: string, connection?: PoolConnection): Promise<AdminContent> {
  const [item] = await query<Row>(
    `SELECT c.id,c.kind,${pinnedExpression} AS pinned,c.created_at AS createdAt,c.updated_at AS updatedAt FROM content_items c WHERE c.id=? AND c.archived_at IS NULL`,
    [id],
    connection,
  )
  if (!item) throw createError({ statusCode: 404, statusMessage: 'CONTENT_NOT_FOUND' })
  const rows = await query<Row>(
    `SELECT t.locale,t.version,t.draft_revision_id AS draftRevisionId,t.published_revision_id AS publishedRevisionId,t.published_at AS publishedAt,r.slug,r.title,r.summary,r.markdown,r.cover_id AS coverId,r.metadata FROM content_translations t JOIN content_revisions r ON r.id=t.draft_revision_id WHERE t.content_id=? AND (?='blog' OR t.locale='zh')`,
    [id, item.kind],
    connection,
  )
  return {
    ...item,
    pinned: Boolean(item.pinned),
    translations: Object.fromEntries(
      rows.map((row) => {
        const metadata = jsonValue<ContentMetadata>(row.metadata)
        const legacyMoment =
          item.kind === 'life' && !metadata.moment
            ? {
                text: [...new Set([row.title, row.summary, markdownText(row.markdown)].filter(Boolean))].join(
                  '\n\n',
                ),
                imageIds: imageReferences(row.markdown, row.coverId),
              }
            : undefined
        return [row.locale, { ...row, metadata, legacyMoment }]
      }),
    ),
  } as AdminContent
}
export async function validateMedia(ids: string[], connection?: PoolConnection) {
  if (!ids.length) return
  const found = await query<Row>(
    `SELECT id FROM media_assets WHERE id IN (${ids.map(() => '?').join(',')})`,
    ids,
    connection,
  )
  if (found.length !== ids.length) throw createError({ statusCode: 422, statusMessage: 'MEDIA_NOT_FOUND' })
}
async function saveRevision(id: string, body: z.infer<typeof draftSchema>, connection: PoolConnection) {
  const [item] = await query<Row>(
    'SELECT id,kind FROM content_items WHERE id=? AND archived_at IS NULL FOR UPDATE',
    [id],
    connection,
  )
  if (!item) throw createError({ statusCode: 404, statusMessage: 'CONTENT_NOT_FOUND' })
  if (item.kind !== 'blog' && body.locale !== 'zh')
    throw createError({ statusCode: 422, statusMessage: 'VALIDATION_ERROR' })
  if (item.kind !== 'life' && body.metadata.moment)
    throw createError({ statusCode: 422, statusMessage: 'VALIDATION_ERROR' })
  if (item.kind === 'life') body = normalizeMomentDraft(body)
  let [translation] = await query<Row>(
    'SELECT * FROM content_translations WHERE content_id=? AND locale=?',
    [id, body.locale],
    connection,
  )
  if ((translation?.version || 0) !== body.expectedVersion)
    throw createError({ statusCode: 409, statusMessage: 'CONFLICT' })
  const mediaIds = [
    ...new Set(
      body.metadata.moment
        ? body.metadata.moment.imageIds
        : [
            ...imageReferences(body.markdown, body.coverId),
            ...(item.kind === 'project'
              ? body.metadata.projectScreenshots.map((image) => image.mediaId)
              : []),
          ],
    ),
  ]
  if (item.kind === 'life' && mediaIds.length > 9)
    throw createError({ statusCode: 422, statusMessage: 'MOMENT_IMAGE_LIMIT' })
  await validateMedia(mediaIds, connection)
  if (!translation) {
    translation = { id: randomUUID() }
    await execute(
      'INSERT INTO content_translations(id,content_id,locale) VALUES(?,?,?)',
      [translation.id, id, body.locale],
      connection,
    )
  }
  const revisionId = randomUUID()
  await execute(
    'INSERT INTO content_revisions(id,translation_id,slug,title,summary,markdown,cover_id,metadata) VALUES(?,?,?,?,?,?,?,?)',
    [
      revisionId,
      translation.id,
      body.slug,
      body.title,
      body.summary,
      body.markdown,
      body.coverId,
      JSON.stringify(body.metadata),
    ],
    connection,
  )
  for (const mediaId of mediaIds)
    await execute(
      'INSERT INTO revision_media(revision_id,media_id) VALUES(?,?)',
      [revisionId, mediaId],
      connection,
    )
  await execute(
    'UPDATE content_translations SET draft_revision_id=?,version=version+1 WHERE id=?',
    [revisionId, translation.id],
    connection,
  )
  await execute('UPDATE content_items SET updated_at=UTC_TIMESTAMP(3) WHERE id=?', [id], connection)
}
export async function saveContent(id: string, body: z.infer<typeof draftSchema>) {
  await transaction((c) => saveRevision(id, body, c))
  return adminDetail(id)
}
// 置顶属于内容本身，切换语言或保存未发布草稿都不会改变它。
export async function pinContent(id: string, pinned: boolean) {
  await transaction(async (connection) => {
    const [item] = await query<Row>(
      'SELECT kind FROM content_items WHERE id=? AND archived_at IS NULL FOR UPDATE',
      [id],
      connection,
    )
    if (!item) throw createError({ statusCode: 404, statusMessage: 'CONTENT_NOT_FOUND' })
    if (pinned) {
      const [published] = await query<Row>(
        'SELECT id FROM content_translations WHERE content_id=? AND published_revision_id IS NOT NULL LIMIT 1',
        [id],
        connection,
      )
      if (!published) throw createError({ statusCode: 422, statusMessage: 'PIN_REQUIRES_PUBLISHED' })
      await execute(
        'INSERT INTO content_pins(kind,content_id) VALUES(?,?) ON DUPLICATE KEY UPDATE content_id=VALUES(content_id)',
        [item.kind, id],
        connection,
      )
    } else {
      await execute('DELETE FROM content_pins WHERE kind=? AND content_id=?', [item.kind, id], connection)
    }
  })
  return adminDetail(id)
}
export async function createContent(authorId: string, kind: string, body: z.infer<typeof draftSchema>) {
  const id = randomUUID()
  await transaction(async (c) => {
    await execute('INSERT INTO content_items(id,kind,author_id) VALUES(?,?,?)', [id, kind, authorId], c)
    await saveRevision(id, body, c)
  })
  return adminDetail(id)
}
export async function publishContent(id: string, locale: Locale, expectedVersion: number, publish: boolean) {
  try {
    await transaction(async (c) => {
      // Serialize publication to reserve slugs across both languages, including fallback URLs.
      await query('SELECT id FROM site_settings WHERE id=1 FOR UPDATE', [], c)
      const [item] = await query<Row>(
        'SELECT id,kind FROM content_items WHERE id=? AND archived_at IS NULL FOR UPDATE',
        [id],
        c,
      )
      if (!item) throw createError({ statusCode: 404, statusMessage: 'CONTENT_NOT_FOUND' })
      const [row] = await query<Row>(
        'SELECT t.*,r.markdown,r.slug,r.metadata FROM content_translations t JOIN content_revisions r ON r.id=t.draft_revision_id WHERE t.content_id=? AND t.locale=?',
        [id, locale],
        c,
      )
      if (!row || row.version !== expectedVersion)
        throw createError({ statusCode: 409, statusMessage: 'CONFLICT' })
      const moment = item.kind === 'life' ? jsonValue<ContentMetadata>(row.metadata).moment : undefined
      if (publish && (moment ? !moment.text.trim() && !moment.imageIds.length : !row.markdown.trim()))
        throw createError({ statusCode: 422, statusMessage: moment ? 'EMPTY_MOMENT' : 'EMPTY_CONTENT' })
      if (publish) {
        const [taken] = await query(
          'SELECT id FROM content_translations WHERE published_slug=? AND content_id<>? LIMIT 1',
          [row.slug, id],
          c,
        )
        if (taken) throw createError({ statusCode: 409, statusMessage: 'SLUG_TAKEN' })
      }
      await execute(
        `UPDATE content_translations SET published_revision_id=?,published_slug=?,published_at=${publish ? 'COALESCE(published_at,UTC_TIMESTAMP(3))' : 'NULL'},version=version+1 WHERE id=?`,
        [publish ? row.draft_revision_id : null, publish ? row.slug : null, row.id],
        c,
      )
    })
  } catch (error: any) {
    if (error.code === 'ER_DUP_ENTRY') throw createError({ statusCode: 409, statusMessage: 'SLUG_TAKEN' })
    throw error
  }
  return adminDetail(id)
}
