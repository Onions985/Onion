import MarkdownIt from 'markdown-it'
import sanitizeHtml from 'sanitize-html'
import hljs from 'highlight.js'
import { createError } from 'h3'

const md = new MarkdownIt({
  html: true,
  linkify: true,
  breaks: false,
  highlight(code, language) {
    if (language && hljs.getLanguage(language))
      return hljs.highlight(code, { language, ignoreIllegals: true }).value
    return ''
  },
})
export function renderArticle(source: string) {
  const tokens = md.parse(source, {})
  const headings: { id: string; text: string; level: number }[] = []
  // Numbered, document-local anchors remain deterministic across SSR and hydration.
  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index]!
    if (token.type !== 'heading_open' || !['h2', 'h3', 'h4'].includes(token.tag)) continue
    const inline = tokens[index + 1]
    const text = (inline?.children || [])
      .filter((child) => ['text', 'code_inline', 'image'].includes(child.type))
      .map((child) => child.content)
      .join('')
    const id = `section-${headings.length + 1}`
    token.attrSet('id', id)
    headings.push({ id, text, level: Number(token.tag.slice(1)) })
  }
  return { html: cleanMarkdown(md.renderer.render(tokens, md.options, {})), headings }
}
export function renderMarkdown(source: string) {
  return cleanMarkdown(md.render(source))
}
function cleanMarkdown(html: string) {
  return sanitizeHtml(html, {
    allowedTags: [...sanitizeHtml.defaults.allowedTags, 'img', 'mark', 'del', 'input', 'details', 'summary'],
    allowedAttributes: {
      a: ['href', 'title'],
      img: ['src', 'alt', 'title', 'width', 'height', 'loading'],
      code: ['class'],
      span: ['class'],
      '*': ['id'],
      input: ['type', 'checked', 'disabled'],
    },
    allowedClasses: { code: ['language-*'], span: ['hljs-*'] },
    allowedSchemes: ['http', 'https', 'mailto'],
    allowProtocolRelative: false,
    transformTags: {
      a: (_tag, attrs) => ({ tagName: 'a', attribs: { ...attrs, rel: 'noopener noreferrer' } }),
      img: (_tag, attrs) => ({
        tagName: 'img',
        attribs: { ...attrs, loading: 'lazy', src: localImage.test(attrs.src || '') ? attrs.src! : '' },
      }),
      input: () => ({ tagName: 'input', attribs: { type: 'checkbox', disabled: 'disabled' } }),
    },
    exclusiveFilter: (frame) => frame.tag === 'img' && !frame.attribs.src,
  })
}
export const localImage = /^\/api\/media\/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/i
export function imageReferences(source: string, coverId: string | null = null) {
  const ids = new Set<string>(coverId ? [coverId] : [])
  // Parse rendered HTML with a parser, never match Markdown with a regular expression.
  sanitizeHtml(md.render(source), {
    allowedTags: ['img'],
    allowedAttributes: { img: ['src'] },
    exclusiveFilter(frame) {
      if (frame.tag === 'img') {
        const match = localImage.exec(frame.attribs.src || '')
        if (!match) throw createError({ statusCode: 422, statusMessage: 'EXTERNAL_IMAGE' })
        ids.add(match[1]!)
      }
      return false
    },
  })
  return [...ids]
}
export const readingMinutes = (source: string) =>
  Math.max(
    1,
    Math.ceil(
      (source.match(/[\u3400-\u9fff]/g) || []).length / 400 +
        source
          .replace(/[\u3400-\u9fff]/g, '')
          .split(/\s+/)
          .filter(Boolean).length /
          220,
    ),
  )

export function markdownText(source: string) {
  const html = md
    .render(source)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|li|blockquote|pre|tr)>/gi, '</$1>\n\n')
  const plain = sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} })
  return md.utils.unescapeAll(plain).trim()
}
