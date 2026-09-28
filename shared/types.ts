export type Locale = 'zh' | 'en'
export type Theme = 'system' | 'light' | 'dark'
export type ContentKind = 'blog' | 'project' | 'life'
export interface SiteProfile {
  locale: Locale
  siteName: string
  displayName: string
  headline: string
  description: string
  motto: string
  aboutMarkdown: string
  footer: string
  quote: string
}
export interface SiteConfig {
  defaultLocale: Locale
  defaultTheme: Theme
  accent: 'lilac' | 'rose' | 'sage'
  avatarId: string | null
  contact?: { qq?: string; wechat: string; wechatQrId?: string | null; email: string }
  startHere?: { blogIds: string[]; projectId: string | null }
  now?: { zh: string; en: string; updatedOn: string }
  socialLinks?: { label: string; url: string }[]
  writingTags: string[]
  navigation: { path: string; label: string }[]
}
export interface SiteResponse {
  siteUrl: string
  config: SiteConfig
  profile: SiteProfile
  messages: Record<string, string>
  aboutHtml: string
  preference: { locale: Locale; theme: Theme }
}
export interface ContentMetadata {
  series?: { name: string; order: number }
  projectStory?: { demoUrl: string; decision: string; outcome: string }
  projectModules?: { title: string; description: string; features: string[] }[]
  projectScreenshots?: { mediaId: string; caption: string }[]
  moment?: { text: string; imageIds: string[] }
  category: string
  tags: string[]
  projectUrl: string
  repositoryUrl: string
  projectStatus: string
  technologies: string[]
  occurredOn: string
  location: string
  featured: boolean
  flagship?: boolean
}
export interface ContentSummary {
  id: string
  pinned: boolean
  kind: ContentKind
  locale: Locale
  slug: string
  title: string
  summary: string
  coverId: string | null
  publishedAt: string
  metadata: ContentMetadata
  readingMinutes: number
}
export interface BlogTags {
  tags: { name: string; count: number }[]
  total: number
}
export interface NavigationPreview {
  sections: Record<ContentKind, { items: ContentSummary[]; total: number }>
  tags: BlogTags['tags']
}
export interface SearchResults {
  items: ContentSummary[]
  total: number
  page: number
  pageSize: number
  counts: Record<ContentKind | 'all', number>
}
export interface ContentDetail extends ContentSummary {
  headings: { id: string; text: string; level: number }[]
  related: ContentSummary[]
  seriesNavigation: { previous: ContentSummary | null; next: ContentSummary | null }
  html: string
  translations: { locale: Locale; slug: string }[]
}
export interface TranslationDraft {
  legacyMoment?: { text: string; imageIds: string[] }
  locale: Locale
  slug: string
  title: string
  summary: string
  markdown: string
  coverId: string | null
  metadata: ContentMetadata
  version: number
  draftRevisionId: string | null
  publishedRevisionId: string | null
  publishedAt: string | null
}
export interface AdminContent {
  id: string
  pinned: boolean
  kind: ContentKind
  createdAt: string
  updatedAt: string
  translations: Partial<Record<Locale, TranslationDraft>>
}
export interface AdminContentSummary extends Omit<AdminContent, 'translations'> {
  translations: Partial<
    Record<Locale, Pick<TranslationDraft, 'title' | 'slug' | 'draftRevisionId' | 'publishedRevisionId'>>
  >
}
export interface AdminContentPage {
  items: AdminContentSummary[]
  total: number
  page: number
  pageSize: number
}
export interface MediaAsset {
  id: string
  originalName: string
  mimeType: string
  size: number
  width: number
  height: number
  url: string
  createdAt: string
}
export interface CommentItem {
  id: string
  contentId: string
  parentId: string | null
  authorName: string
  body: string
  isAuthor: boolean
  status: 'pending' | 'approved' | 'hidden'
  createdAt: string
  contentTitle?: string
  kind?: ContentKind
}
export interface AdminCommentsPage {
  items: CommentItem[]
  total: number
  page: number
  pageSize: number
}
