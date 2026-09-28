import { defineEventHandler, setHeader } from 'h3'
import { siteOrigin } from '../utils/site-origin'

export default defineEventHandler((event) => {
  setHeader(event, 'Content-Type', 'text/plain; charset=utf-8')
  return `User-agent: *\nAllow: /\nAllow: /api/media/\nDisallow: /admin\nDisallow: /api/\nDisallow: /zh/search\nDisallow: /en/search\nSitemap: ${siteOrigin()}/sitemap.xml\n`
})
