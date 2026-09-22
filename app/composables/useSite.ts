import type { SiteResponse, Locale, Theme, ContentSummary } from '../../shared/types'

export function useSite() {
  const route = useRoute(),
    cookie = useCookie<Locale>('onion_locale'),
    themeCookie = useCookie<Theme>('onion_theme')
  const locale = computed<Locale>(() =>
    route.params.locale === 'en'
      ? 'en'
      : route.params.locale === 'zh'
        ? 'zh'
        : cookie.value === 'en'
          ? 'en'
          : 'zh',
  )
  const site = useState<SiteResponse | null>('site', () => null)
  const theme = useState<Theme>('theme', () => themeCookie.value || 'system')
  const translations = useState<{ locale: Locale; slug: string }[]>('content-translations', () => [])
  const t = (key: string) => site.value?.messages[key] || key
  const contentUrl = (item: Pick<ContentSummary, 'kind' | 'slug'>, lang: Locale = locale.value) =>
    `/${lang}/${item.kind === 'blog' ? 'posts' : item.kind === 'project' ? 'projects' : 'life'}/${item.slug}`
  const blogTag = computed(() => {
    const value = route.params.tag ?? route.query.tag
    return typeof value === 'string' ? value.trim().slice(0, 40) : ''
  })
  const tagUrl = (tag: string, lang: Locale = locale.value) => `/${lang}/tags/${encodeURIComponent(tag)}`
  async function preference(nextLocale: Locale, nextTheme: Theme) {
    await apiWrite('/api/preferences', 'PUT', { locale: nextLocale, theme: nextTheme })
    cookie.value = nextLocale
    theme.value = nextTheme
    themeCookie.value = nextTheme
  }
  return { site, locale, theme, t, contentUrl, tagUrl, blogTag, preference, translations }
}
export function apiWrite<T = any>(url: string, method: 'POST' | 'PUT' | 'DELETE', body?: any): Promise<T> {
  return $fetch<T>(url, { method, body, headers: { 'x-onion-request': '1' } } as any) as Promise<T>
}
export function useFeedback() {
  const { t } = useSite()
  const message = useState('feedback', () => ({ text: '', error: false }))
  const notify = (text: string, error = false) => {
    message.value = { text, error }
  }
  const fail = (error: any) => {
    const code = error?.data?.statusMessage || error?.statusMessage
    notify(t(code && t(`error.${code}`) !== `error.${code}` ? `error.${code}` : 'error.generic'), true)
  }
  return { message, notify, fail }
}
