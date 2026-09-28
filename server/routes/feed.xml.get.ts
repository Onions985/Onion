import { defineEventHandler, getQuery, setHeader } from 'h3'
import { publicFeed } from '../utils/content'
import { query } from '../utils/database'
import { siteOrigin } from '../utils/site-origin'
import { rssDocument } from '../../shared/discovery'

export default defineEventHandler(async (event) => {
  const locale = getQuery(event).locale === 'en' ? 'en' : 'zh'
  const [items, profiles] = await Promise.all([
    publicFeed(locale),
    query<{ siteName: string; description: string }>(
      'SELECT site_name AS siteName,description FROM site_profiles WHERE locale=?',
      [locale],
    ),
  ])
  setHeader(event, 'Content-Type', 'application/rss+xml; charset=utf-8')
  setHeader(event, 'Cache-Control', 'no-cache')
  return rssDocument(siteOrigin(), locale, profiles[0] || { siteName: 'onion', description: '' }, items)
})
