export default defineNuxtConfig({
  compatibilityDate: '2026-09-01',
  devtools: { enabled: false },
  // The API also reads SITE_URL at runtime so a built image can use its deployment domain.
  runtimeConfig: { public: { siteUrl: process.env.SITE_URL || 'http://localhost:3000' } },
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
    '~/assets/css/discovery.css',
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
