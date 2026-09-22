import { createError, getHeader, type H3Event } from 'h3'
import type { z } from 'zod'
export async function readJson<T extends z.ZodType>(event: H3Event, schema: T): Promise<z.output<T>> {
  if (!getHeader(event, 'content-type')?.includes('application/json'))
    throw createError({ statusCode: 415, statusMessage: 'JSON_REQUIRED' })
  const limit = 1024 * 1024
  const chunks: Buffer[] = []
  let size = 0
  for await (const part of event.node.req) {
    const buffer = Buffer.isBuffer(part) ? part : Buffer.from(part)
    size += buffer.length
    if (size > limit) throw createError({ statusCode: 413, statusMessage: 'BODY_TOO_LARGE' })
    chunks.push(buffer)
  }
  let body: unknown
  try {
    body = JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    throw createError({ statusCode: 400, statusMessage: 'INVALID_JSON' })
  }
  const result = schema.safeParse(body)
  if (!result.success)
    throw createError({
      statusCode: 422,
      statusMessage: 'VALIDATION_ERROR',
      data: {
        issues: result.error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
      },
    })
  return result.data
}
