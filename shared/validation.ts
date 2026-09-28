import { z } from 'zod'

export const localeSchema = z.enum(['zh', 'en'])
export const kindSchema = z.enum(['blog', 'project', 'life'])
export const themeSchema = z.enum(['system', 'light', 'dark'])
const tag = z
  .string()
  .trim()
  .min(1)
  .max(40)
  .transform((value) => {
    const names: Record<string, string> = { android: 'Android', ios: 'iOS', java: 'Java', ai: 'AI' }
    return names[value.toLowerCase()] || value
  })
const tagList = (max: number) =>
  z
    .array(tag)
    .max(max)
    .transform((values) => [...new Set(values)])
const safeUrl = z
  .string()
  .trim()
  .max(1000)
  .refine((value) => {
    if (!value) return true
    try {
      const url = new URL(value)
      return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password
    } catch {
      return false
    }
  }, 'Use an http(s) URL')
export const metadataSchema = z.object({
  series: z
    .object({ name: z.string().trim().max(100), order: z.number().int().min(1).max(10000) })
    .optional(),
  projectStory: z
    .object({
      demoUrl: safeUrl.default(''),
      decision: z.string().trim().max(3000).default(''),
      outcome: z.string().trim().max(3000).default(''),
    })
    .optional(),
  projectModules: z
    .array(
      z.object({
        title: z.string().trim().min(1).max(100),
        description: z.string().trim().max(1000),
        features: z.array(z.string().trim().min(1).max(1000)).max(15),
      }),
    )
    .max(24)
    .default([]),
  projectScreenshots: z
    .array(z.object({ mediaId: z.uuid(), caption: z.string().trim().max(200) }))
    .max(20)
    .refine(
      (items) => new Set(items.map((item) => item.mediaId)).size === items.length,
      'Duplicate screenshot',
    )
    .default([]),
  moment: z
    .object({
      text: z.string().max(10000),
      imageIds: z
        .array(z.uuid())
        .max(9)
        .refine((ids) => new Set(ids).size === ids.length, 'Duplicate image'),
    })
    .optional(),
  category: z.string().trim().max(60).default(''),
  tags: tagList(12).default([]),
  projectUrl: safeUrl.default(''),
  repositoryUrl: safeUrl.default(''),
  projectStatus: z.string().max(60).default(''),
  technologies: z.array(z.string().trim().min(1).max(40)).max(15).default([]),
  occurredOn: z
    .string()
    .regex(/^$|^\d{4}-\d{2}-\d{2}$/)
    .default(''),
  location: z.string().max(100).default(''),
  featured: z.boolean().default(false),
  flagship: z.boolean().default(false),
})
export const draftSchema = z.object({
  locale: localeSchema,
  slug: z
    .string()
    .trim()
    .min(1)
    .max(160)
    .regex(/^[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*$/u),
  title: z.string().trim().min(1).max(200),
  summary: z.string().trim().max(500).default(''),
  markdown: z.string().max(200000),
  coverId: z.uuid().nullable().default(null),
  metadata: metadataSchema,
  expectedVersion: z.number().int().min(0),
})
export const publishSchema = z.object({ locale: localeSchema, expectedVersion: z.number().int().min(1) })
export const profileSchema = z.object({
  locale: localeSchema,
  siteName: z.string().trim().min(1).max(80),
  displayName: z.string().trim().min(1).max(80),
  headline: z.string().trim().min(1).max(150),
  description: z.string().max(500),
  motto: z.string().max(150),
  aboutMarkdown: z.string().max(50000),
  footer: z.string().max(200),
  quote: z.string().max(500),
})
export const configSchema = z.object({
  startHere: z
    .object({
      blogIds: z
        .array(z.uuid())
        .max(2)
        .refine((ids) => new Set(ids).size === ids.length),
      projectId: z.uuid().nullable(),
    })
    .optional(),
  now: z
    .object({
      zh: z.string().trim().max(1200),
      en: z.string().trim().max(1200),
      updatedOn: z.union([z.literal(''), z.iso.date()]),
    })
    .refine((value) => !(value.zh || value.en) || Boolean(value.updatedOn), 'Set an update date')
    .optional(),
  socialLinks: z
    .array(z.object({ label: z.string().trim().min(1).max(40), url: safeUrl.refine(Boolean, 'Enter a URL') }))
    .max(6)
    .optional(),
  defaultLocale: localeSchema,
  defaultTheme: themeSchema,
  accent: z.enum(['lilac', 'rose', 'sage']),
  avatarId: z.uuid().nullable(),
  contact: z
    .object({
      qq: z
        .string()
        .trim()
        .regex(/^$|^[1-9]\d{4,11}$/)
        .default(''),
      wechat: z.string().trim().max(80).default(''),
      wechatQrId: z.uuid().nullable().default(null),
      email: z.union([z.literal(''), z.email().max(254)]).default(''),
    })
    .default({ qq: '', wechat: '', wechatQrId: null, email: '' }),
  writingTags: tagList(24).default([]),
  navigation: z
    .array(
      z.object({
        path: z.enum(['', 'writing', 'projects', 'life', 'about']),
        label: z.enum(['nav.home', 'nav.writing', 'nav.projects', 'nav.life', 'nav.about']),
      }),
    )
    .min(1)
    .max(5),
})
