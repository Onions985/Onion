import type { z } from 'zod'
import type { draftSchema } from './validation'

export function normalizeMomentDraft(body: z.infer<typeof draftSchema>) {
  const moment = body.metadata.moment
  if (!moment) return body
  const text = moment.text.trim()
  return {
    ...body,
    title:
      text
        .split('\n')
        .find((line) => line.trim())
        ?.trim()
        .slice(0, 80) || `手记${body.metadata.occurredOn ? ` · ${body.metadata.occurredOn}` : ''}`,
    summary: text.slice(0, 500),
    // Keep search and Markdown consumers readable without interpreting a status as rich text.
    markdown: text.replace(/([\\`*_[\]{}<>()#+.!|~\-])/g, '\\$1').replace(/\n/g, '  \n'),
    coverId: moment.imageIds[0] || null,
    metadata: { ...body.metadata, moment: { text, imageIds: [...moment.imageIds] } },
  }
}
