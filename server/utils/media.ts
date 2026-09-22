import { randomUUID, createHash } from 'node:crypto'
import { mkdir, writeFile, unlink, readFile } from 'node:fs/promises'
import { resolve, dirname, sep } from 'node:path'
import Busboy from 'busboy'
import { fileTypeFromBuffer } from 'file-type'
import { imageSize } from 'image-size'
import { createError, getHeader, setResponseHeaders, send, type H3Event } from 'h3'
import { query, execute, jsonValue } from './database'
import { currentUser } from './auth'
import type { SiteConfig } from '../../shared/types'
import { imageReferences } from './markdown'

const maxSize = 8 * 1024 * 1024
const root = () => resolve(process.env.UPLOAD_DIR || './data/uploads')
function filePath(relative: string) {
  const base = root(),
    full = resolve(base, relative)
  if (!full.startsWith(base + sep)) throw new Error('Invalid media path')
  return full
}
export async function uploadImage(event: H3Event, ownerId: string) {
  if (Number(getHeader(event, 'content-length')) > maxSize + 65536)
    throw createError({ statusCode: 413, statusMessage: 'MEDIA_TOO_LARGE' })
  const file = await new Promise<{ buffer: Buffer; name: string }>((resolveFile, reject) => {
    let parser: ReturnType<typeof Busboy>
    try {
      parser = Busboy({
        headers: event.node.req.headers,
        limits: { fileSize: maxSize, files: 1, fields: 0, parts: 1 },
      })
    } catch {
      reject(createError({ statusCode: 400, statusMessage: 'FILE_REQUIRED' }))
      return
    }
    let result: { buffer: Buffer; name: string } | undefined, failure: Error | undefined
    parser.on('file', (_name, stream, info) => {
      const chunks: Buffer[] = []
      stream.on('data', (chunk) => chunks.push(chunk))
      stream.on('limit', () => {
        failure = createError({ statusCode: 413, statusMessage: 'MEDIA_TOO_LARGE' })
      })
      stream.on('end', () => {
        result = { buffer: Buffer.concat(chunks), name: info.filename.slice(0, 255) }
      })
      stream.on('error', reject)
    })
    parser.on('filesLimit', () => {
      failure = createError({ statusCode: 400, statusMessage: 'ONE_IMAGE_ONLY' })
    })
    parser.on('error', reject)
    parser.on('close', () =>
      failure
        ? reject(failure)
        : result
          ? resolveFile(result)
          : reject(createError({ statusCode: 400, statusMessage: 'FILE_REQUIRED' })),
    )
    event.node.req.on('aborted', () =>
      reject(createError({ statusCode: 400, statusMessage: 'UPLOAD_ABORTED' })),
    )
    event.node.req.pipe(parser)
  })
  const type = await fileTypeFromBuffer(file.buffer)
  if (!type || !['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(type.mime))
    throw createError({ statusCode: 415, statusMessage: 'MEDIA_TYPE' })
  let dimensions
  try {
    dimensions = imageSize(file.buffer)
  } catch {
    throw createError({ statusCode: 415, statusMessage: 'MEDIA_TYPE' })
  }
  if (!dimensions.width || !dimensions.height || dimensions.width * dimensions.height > 40_000_000)
    throw createError({ statusCode: 422, statusMessage: 'MEDIA_DIMENSIONS' })
  const id = randomUUID(),
    relative = `${new Date().toISOString().slice(0, 7)}/${id}.${type.ext}`,
    path = filePath(relative)
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, file.buffer, { flag: 'wx' })
  try {
    await execute(
      'INSERT INTO media_assets(id,relative_path,owner_id,original_name,mime_type,size,width,height,sha256) VALUES(?,?,?,?,?,?,?,?,?)',
      [
        id,
        relative,
        ownerId,
        file.name,
        type.mime,
        file.buffer.length,
        dimensions.width,
        dimensions.height,
        createHash('sha256').update(file.buffer).digest('hex'),
      ],
    )
  } catch (error) {
    await unlink(path)
    throw error
  }
  return {
    id,
    url: `/api/media/${id}`,
    originalName: file.name,
    mimeType: type.mime,
    size: file.buffer.length,
    width: dimensions.width,
    height: dimensions.height,
  }
}
export async function serveImage(event: H3Event, id: string) {
  const [asset] = await query<Record<string, any>>('SELECT * FROM media_assets WHERE id=?', [id])
  if (!asset) throw createError({ statusCode: 404, statusMessage: 'MEDIA_NOT_FOUND' })
  const [ref] = await query(
    'SELECT m.media_id FROM revision_media m JOIN content_translations t ON t.published_revision_id=m.revision_id JOIN content_items c ON c.id=t.content_id WHERE m.media_id=? AND c.archived_at IS NULL LIMIT 1',
    [id],
  )
  const [settings] = await query<{ config: unknown }>('SELECT config FROM site_settings WHERE id=1')
  const publicAvatar = jsonValue<SiteConfig>(settings?.config || {}).avatarId === id
  const profiles = await query<{ markdown: string }>('SELECT about_markdown AS markdown FROM site_profiles')
  const inAbout = profiles.some((p) => imageReferences(p.markdown).includes(id))
  if (!ref && !publicAvatar && !inAbout && !(await currentUser(event)))
    throw createError({ statusCode: 404, statusMessage: 'MEDIA_NOT_FOUND' })
  let bytes: Buffer
  try {
    bytes = await readFile(filePath(asset.relative_path))
  } catch {
    throw createError({ statusCode: 404, statusMessage: 'MEDIA_NOT_FOUND' })
  }
  setResponseHeaders(event, {
    'Content-Type': asset.mime_type,
    'Content-Length': bytes.length,
    'Cache-Control': 'private, no-store',
    'Content-Disposition': 'inline',
    'X-Content-Type-Options': 'nosniff',
  })
  return send(event, bytes)
}
