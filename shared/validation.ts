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
  .max(1000)
  .refine((value) => !value || /^https?:\/\//i.test(value), 'Use an http(s) URL')
export const metadataSchema = z.object({
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
  defaultLocale: localeSchema,
  defaultTheme: themeSchema,
  accent: z.enum(['lilac', 'rose', 'sage']),
  avatarId: z.uuid().nullable(),
  contact: z
    .object({
      wechat: z.string().trim().max(80).default(''),
      email: z.union([z.literal(''), z.email().max(254)]).default(''),
    })
    .default({ wechat: '', email: '' }),
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
