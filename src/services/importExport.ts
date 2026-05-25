import type { Quote } from '../types/quote'
import { normalizeTags } from '../db/database'
import { csvEscape, parseCsv } from './csv'

type ImportRow = Partial<Quote> & {
  tags?: string[] | string
}

export function parseJsonImport(content: string): Quote[] {
  const parsed = JSON.parse(content) as ImportRow[] | { quotes: ImportRow[] }
  const rows = Array.isArray(parsed) ? parsed : parsed.quotes
  if (!Array.isArray(rows)) throw new Error('JSON must be an array or an object with a quotes array.')
  return rows.map(normalizeImportedQuote)
}

export function parseCsvImport(content: string): Quote[] {
  const rows = parseCsv(content)
  if (rows.length < 2) return []

  const headers = rows[0].map((header) => header.trim())
  return rows.slice(1).filter((row) => row.some(Boolean)).map((row) => {
    const entry: Record<string, string> = {}
    headers.forEach((header, index) => {
      entry[header] = row[index] ?? ''
    })
    return normalizeImportedQuote(entry)
  })
}

export function exportJson(quotes: Quote[]) {
  return JSON.stringify({ exportedAt: new Date().toISOString(), quotes }, null, 2)
}

export function exportCsv(quotes: Quote[]) {
  const headers = ['text', 'author', 'work', 'source', 'year', 'tags', 'note', 'favorite', 'likes']
  const rows = quotes.map((quote) =>
    [
      quote.text,
      quote.author ?? '',
      quote.work ?? '',
      quote.source ?? '',
      quote.year ?? '',
      quote.tags.join(', '),
      quote.note ?? '',
      quote.favorite ? 'true' : 'false',
      String(quote.likes ?? 0)
    ].map(csvEscape)
  )

  return [headers.join(','), ...rows.map((row) => row.join(','))].join('\n')
}

export function exportMarkdown(quotes: Quote[]) {
  return quotes
    .map((quote) => {
      const attribution = [quote.author, quote.work, quote.year].filter(Boolean).join(', ')
      const tags = quote.tags.length ? `\n\nTags: ${quote.tags.map((tag) => `#${tag}`).join(' ')}` : ''
      const note = quote.note ? `\n\nNote: ${quote.note}` : ''
      const content = quote.text ? `> ${quote.text}` : quote.imageDataUrl ? '[Photo note]' : '[Voice note]'
      return `${content}\n\n${attribution ? `- ${attribution}` : ''}${tags}${note}`
    })
    .join('\n\n---\n\n')
}

export function downloadText(filename: string, content: string, type = 'text/plain') {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

function normalizeImportedQuote(row: ImportRow | Record<string, string>): Quote {
  const timestamp = new Date().toISOString()
  const rawTags = row.tags
  const tags = Array.isArray(rawTags) ? rawTags : String(rawTags ?? '').split(/[;,]/)

  return {
    id: row.id || crypto.randomUUID(),
    text: String(row.text ?? '').trim(),
    author: optional(row.author),
    source: optional(row.source),
    work: optional(row.work),
    year: optional(row.year),
    bookId: optional(row.bookId),
    tags: normalizeTags(tags),
    note: optional(row.note),
    audioDataUrl: optional(row.audioDataUrl),
    audioMimeType: optional(row.audioMimeType),
    audioDurationMs: row.audioDurationMs ? Number(row.audioDurationMs) : undefined,
    imageDataUrl: optional(row.imageDataUrl),
    imageMimeType: optional(row.imageMimeType),
    favorite: row.favorite === true || String(row.favorite).toLowerCase() === 'true',
    likes: Number(row.likes ?? 0) || 0,
    createdAt: row.createdAt || timestamp,
    updatedAt: row.updatedAt || timestamp,
    reviewCount: Number(row.reviewCount ?? 0),
    lastReviewedAt: optional(row.lastReviewedAt),
    nextReviewAt: optional(row.nextReviewAt)
  }
}

function optional(value: unknown) {
  const normalized = String(value ?? '').trim()
  return normalized.length ? normalized : undefined
}
