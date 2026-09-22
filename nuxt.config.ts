export default defineNuxtConfig({
  compatibilityDate: '2026-09-01',
  devtools: { enabled: false },
  css: [
    '~/assets/css/main.css',
    '~/assets/css/collections.css',
    '~/assets/css/navigation.css',
    '~/assets/css/introduction.css',
    '~/assets/css/scroll-effects.css',
    '~/assets/css/moments.css',
    '~/assets/css/about.css',
    '~/assets/css/projects.css',
    '~/assets/css/home-writing.css',
  ],
  typescript: { strict: true },
  app: {
    head: {
      title: 'onion',
      meta: [{ name: 'viewport', content: 'width=device-width, initial-scale=1' }],
      link: [{ key: 'site-icon', rel: 'icon', href: '/brand/onion-mark.svg' }],
    },
  },
  nitro: { preset: 'node-server', externals: { external: ['mysql2'] } },
  routeRules: { '/admin/**': { headers: { 'X-Robots-Tag': 'noindex, nofollow' } } },
})
