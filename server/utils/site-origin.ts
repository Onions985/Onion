import { createError } from 'h3'

export function siteOrigin() {
  const value = process.env.NUXT_PUBLIC_SITE_URL || process.env.SITE_URL || 'http://localhost:3000'
  try {
    const url = new URL(value)
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error()
    return url.origin
  } catch {
    throw createError({ statusCode: 503, statusMessage: 'INVALID_SITE_URL' })
  }
}
