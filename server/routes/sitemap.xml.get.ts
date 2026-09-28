import { defineEventHandler, setHeader } from 'h3'
import { publicSitemap } from '../utils/content'
import { siteOrigin } from '../utils/site-origin'
import { contentPath, xmlEscape } from '../../shared/discovery'

export default defineEventHandler(async (event) => {
  const origin = siteOrigin()
  const rows = await publicSitemap()
  const paths = ['zh', 'en'].flatMap((locale) =>
    ['', '/writing', '/projects', '/life', '/about'].map((path) => ({ path: `/${locale}${path}`, date: '' })),
  )
  for (const row of rows) {
    paths.push({ path: contentPath(row, row.locale), date: row.modifiedAt.slice(0, 10) })
    if (row.kind !== 'blog') paths.push({ path: contentPath(row, 'en'), date: row.modifiedAt.slice(0, 10) })
  }
  setHeader(event, 'Content-Type', 'application/xml; charset=utf-8')
  setHeader(event, 'Cache-Control', 'no-cache')
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${paths.map((item) => `<url><loc>${xmlEscape(origin + item.path)}</loc>${item.date ? `<lastmod>${item.date}</lastmod>` : ''}</url>`).join('')}</urlset>`
})
