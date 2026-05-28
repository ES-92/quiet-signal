import type { Quote } from '../types/quote'
import type { Book } from '../types/book'
import { normalizeTags } from '../db/database'
import { csvEscape, parseCsv } from './csv'

type ImportRow = Partial<Quote> & {
  tags?: string[] | string
}

type BookImportRow = Partial<Book>
type ImportBundle = {
  quotes?: ImportRow[]
  books?: BookImportRow[]
}

const safeIdPattern = /^[A-Za-z0-9_-]{1,80}$/
const maxImportedMediaChars = 8_000_000
const allowedImageMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
const allowedAudioMimeTypes = new Set(['audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/x-wav', 'audio/aac'])

export function parseJsonImport(content: string): Quote[] {
  return parseJsonImportBundle(content).quotes
}

export function parseJsonImportBundle(content: string): { quotes: Quote[]; books: Book[] } {
  const parsed = JSON.parse(content) as ImportRow[] | ImportBundle
  const rows = Array.isArray(parsed) ? parsed : parsed.quotes
  if (!Array.isArray(rows)) throw new Error('JSON must be an array or an object with a quotes array.')
  const books = !Array.isArray(parsed) && Array.isArray(parsed.books) ? parsed.books.map(normalizeImportedBook) : []
  return { quotes: rows.map(normalizeImportedQuote), books }
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

export function exportJson(quotes: Quote[], books: Book[] = []) {
  return JSON.stringify({ app: 'Quiet Signal', version: 1, exportedAt: new Date().toISOString(), books, quotes }, null, 2)
}

export function exportCsv(quotes: Quote[]) {
  const headers = [
    'text',
    'author',
    'work',
    'source',
    'year',
    'tags',
    'note',
    'favorite',
    'likes',
    'status',
    'signalStrength',
    'entryType',
    'occurredAt',
    'people',
    'locationName',
    'locationLatitude',
    'locationLongitude'
  ]
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
      String(quote.likes ?? 0),
      quote.status ?? 'signal',
      quote.signalStrength ?? 'normal',
      quote.entryType ?? 'note',
      quote.occurredAt ?? '',
      quote.people?.join(', ') ?? '',
      quote.locationName ?? '',
      quote.locationLatitude !== undefined ? String(quote.locationLatitude) : '',
      quote.locationLongitude !== undefined ? String(quote.locationLongitude) : ''
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
      const context = [
        quote.entryType ? `Type: ${quote.entryType}` : '',
        quote.occurredAt ? `Date: ${quote.occurredAt}` : '',
        quote.people?.length ? `People: ${quote.people.join(', ')}` : '',
        quote.locationName ? `Location: ${quote.locationName}` : ''
      ].filter(Boolean)
      const details = context.length ? `\n\n${context.join('\n')}` : ''
      const content = quote.text ? `> ${quote.text}` : quote.imageDataUrl ? '[Photo note]' : '[Voice note]'
      return `${content}\n\n${attribution ? `- ${attribution}` : ''}${details}${tags}${note}`
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
    id: safeImportedId(row.id) ?? crypto.randomUUID(),
    text: String(row.text ?? '').trim(),
    author: optional(row.author),
    source: optional(row.source),
    work: optional(row.work),
    year: optional(row.year),
    bookId: safeImportedId(row.bookId),
    tags: normalizeTags(tags),
    note: optional(row.note),
    audioDataUrl: safeMediaDataUrl(row.audioDataUrl, allowedAudioMimeTypes),
    audioMimeType: safeMediaMimeType(row.audioDataUrl, row.audioMimeType, allowedAudioMimeTypes),
    audioDurationMs: row.audioDurationMs ? Number(row.audioDurationMs) : undefined,
    imageDataUrl: safeMediaDataUrl(row.imageDataUrl, allowedImageMimeTypes),
    imageMimeType: safeMediaMimeType(row.imageDataUrl, row.imageMimeType, allowedImageMimeTypes),
    favorite: row.favorite === true || String(row.favorite).toLowerCase() === 'true',
    likes: Number(row.likes ?? 0) || 0,
    status: row.status === 'inbox' ? 'inbox' : 'signal',
    signalStrength: row.signalStrength === 'quiet' || row.signalStrength === 'strong' ? row.signalStrength : 'normal',
    entryType: normalizeEntryType(row.entryType),
    occurredAt: optional(row.occurredAt),
    people: Array.isArray(row.people) ? row.people : String(row.people ?? '').split(/[;,]/).map((person) => person.trim()).filter(Boolean),
    locationName: optional(row.locationName),
    locationLatitude: optionalNumber(row.locationLatitude),
    locationLongitude: optionalNumber(row.locationLongitude),
    createdAt: row.createdAt || timestamp,
    updatedAt: row.updatedAt || timestamp,
    reviewCount: Number(row.reviewCount ?? 0),
    lastReviewedAt: optional(row.lastReviewedAt),
    nextReviewAt: optional(row.nextReviewAt)
  }
}

function normalizeImportedBook(row: BookImportRow): Book {
  const timestamp = new Date().toISOString()
  const weight = row.weight === 'rare' || row.weight === 'often' ? row.weight : 'normal'
  const source = row.source === 'kindle' || row.source === 'readwise' ? row.source : 'manual'

  return {
    id: safeImportedId(row.id) ?? crypto.randomUUID(),
    title: optional(row.title) ?? 'Untitled book',
    author: optional(row.author),
    weight,
    source,
    createdAt: row.createdAt || timestamp,
    updatedAt: row.updatedAt || timestamp
  }
}

function optional(value: unknown) {
  const normalized = String(value ?? '').trim()
  return normalized.length ? normalized : undefined
}

function safeImportedId(value: unknown) {
  const normalized = optional(value)
  return normalized && safeIdPattern.test(normalized) ? normalized : undefined
}

function safeMediaDataUrl(value: unknown, allowedMimeTypes: Set<string>) {
  const normalized = optional(value)
  if (!normalized || normalized.length > maxImportedMediaChars) return undefined
  const mimeType = mediaDataUrlMimeType(normalized)
  return mimeType && allowedMimeTypes.has(mimeType) ? normalized : undefined
}

function safeMediaMimeType(dataUrl: unknown, fallbackMimeType: unknown, allowedMimeTypes: Set<string>) {
  const fromDataUrl = mediaDataUrlMimeType(String(dataUrl ?? ''))
  if (fromDataUrl && allowedMimeTypes.has(fromDataUrl)) return fromDataUrl
  const fallback = optional(fallbackMimeType)?.toLowerCase()
  return fallback && allowedMimeTypes.has(fallback) ? fallback : undefined
}

function mediaDataUrlMimeType(value: string) {
  const match = /^data:([^;,]+)(?:;[^,]*)?;base64,/i.exec(value)
  return match?.[1]?.toLowerCase()
}

function optionalNumber(value: unknown) {
  const number = Number(value)
  return Number.isFinite(number) ? number : undefined
}

function normalizeEntryType(value: unknown): Quote['entryType'] {
  if (value === 'memory' || value === 'book_quote' || value === 'idea' || value === 'conversation' || value === 'observation') {
    return value
  }
  return 'note'
}
