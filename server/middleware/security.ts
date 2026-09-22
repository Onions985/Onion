import { defineEventHandler, getHeader, getMethod, getRequestURL, createError, setResponseHeaders } from 'h3'
export default defineEventHandler((event) => {
  setResponseHeaders(event, {
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-Frame-Options': 'DENY',
  })
  if (!event.path.startsWith('/api/')) return
  if (event.path.startsWith('/api/admin/') || event.path.startsWith('/api/auth/'))
    setResponseHeaders(event, { 'Cache-Control': 'no-store' })
  if (['GET', 'HEAD', 'OPTIONS'].includes(getMethod(event))) return
  if (getHeader(event, 'x-onion-request') !== '1')
    throw createError({ statusCode: 403, statusMessage: 'REQUEST_HEADER_REQUIRED' })
  const origin = getHeader(event, 'origin')
  const allowed = new Set([getRequestURL(event).origin, process.env.SITE_URL].filter(Boolean))
  if (origin && !allowed.has(origin))
    throw createError({ statusCode: 403, statusMessage: 'ORIGIN_NOT_ALLOWED' })
})
