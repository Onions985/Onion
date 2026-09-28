import type { ContentSummary, Locale } from './types'

export const contentPath = (item: Pick<ContentSummary, 'kind' | 'slug'>, locale: Locale) =>
  `/${locale}/${item.kind === 'blog' ? 'posts' : item.kind === 'project' ? 'projects' : 'life'}/${encodeURIComponent(item.slug)}`

export const xmlEscape = (value: string) =>
  value
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
    .replace(
      /[<>&"']/g,
      (char) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[char]!,
    )

export function canonicalPath(path: string, query: Record<string, unknown>) {
  let result = path.replace(/\/$/, '') || '/'
  const locale = result.split('/')[1]
  if (/^\/(zh|en)\/writing$/.test(result) && typeof query.tag === 'string' && query.tag.trim())
    result = `/${locale}/tags/${encodeURIComponent(query.tag.trim().slice(0, 40))}`
  if (/^\/(zh|en)\/(writing|projects|life|tags\/[^/]+)$/.test(result)) {
    const page = Math.floor(Math.max(1, Math.min(10000, Number(query.page) || 1)))
    if (page > 1) result += `?page=${page}`
  }
  return result
}

export function rssDocument(
  origin: string,
  locale: Locale,
  profile: { siteName: string; description: string },
  items: ContentSummary[],
) {
  const x = xmlEscape
  const channel = `<title>${x(profile.siteName)}</title><link>${x(origin + '/' + locale + '/writing')}</link><description>${x(profile.description)}</description><language>${locale === 'zh' ? 'zh-CN' : 'en'}</language><atom:link href="${x(origin + '/feed.xml?locale=' + locale)}" rel="self" type="application/rss+xml"/>`
  return `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel>${channel}${items
    .map((item) => {
      const url = origin + contentPath(item, locale)
      const date = new Date(
        item.publishedAt.replace(' ', 'T') + (/(Z|[+-]\d{2}:\d{2})$/.test(item.publishedAt) ? '' : 'Z'),
      ).toUTCString()
      return `<item><title>${x(item.title)}</title><link>${x(url)}</link><guid isPermaLink="false">${x(origin + ':' + item.id + ':' + locale)}</guid><description>${x(item.summary)}</description><pubDate>${date}</pubDate>${item.metadata.tags.map((tag) => `<category>${x(tag)}</category>`).join('')}</item>`
    })
    .join('')}</channel></rss>`
}
