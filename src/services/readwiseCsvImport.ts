import { normalizeTags } from '../db/database'
import { bookKey, type Book } from '../types/book'
import type { Quote } from '../types/quote'
import { parseCsv } from './csv'

interface ReadwiseRow {
  text: string
  title: string
  author?: string
  note?: string
  tags: string[]
  category?: string
  location?: string
  url?: string
  highlightedAt?: string
}

export interface ReadwiseCsvImportPlan {
  newBooks: Book[]
  newQuotes: Quote[]
  importedCount: number
  skippedCount: number
  bookCount: number
}

const textAliases = ['highlight', 'highlight text', 'highlight_text', 'text', 'quote']
const titleAliases = ['book title', 'book_title', 'title', 'document title', 'source title']
const authorAliases = ['book author', 'book_author', 'author']
const noteAliases = ['note', 'notes', 'annotation']
const tagsAliases = ['tags', 'tag']
const categoryAliases = ['category', 'type']
const locationAliases = ['location', 'location number', 'location_number', 'page', 'position']
const urlAliases = ['url', 'source url', 'source_url', 'document url', 'document_url']
const dateAliases = ['highlighted at', 'highlighted_at', 'created at', 'created_at', 'date', 'highlight date']

export function buildReadwiseCsvImport(
  content: string,
  existingBooks: Book[],
  existingQuotes: Quote[]
): ReadwiseCsvImportPlan {
  const rows = readRows(content)
  const now = new Date().toISOString()
  const bookByKey = new Map<string, Book>()
  for (const book of existingBooks) bookByKey.set(bookKey(book.title, book.author), book)

  const seenTextsByKey = new Map<string, Set<string>>()
  const idToKey = new Map(existingBooks.map((book) => [book.id, bookKey(book.title, book.author)]))
  for (const quote of existingQuotes) {
    const key = (quote.bookId && idToKey.get(quote.bookId)) || bookKey(quote.work ?? quote.source ?? '', quote.author)
    if (!seenTextsByKey.has(key)) seenTextsByKey.set(key, new Set())
    seenTextsByKey.get(key)!.add(normalize(quote.text))
  }

  const newBooks: Book[] = []
  const newQuotes: Quote[] = []
  const touchedBooks = new Set<string>()
  let skipped = 0

  for (const row of rows) {
    if (!row.text || !row.title) {
      skipped += 1
      continue
    }

    const key = bookKey(row.title, row.author)
    let book = bookByKey.get(key)
    if (!book) {
      book = {
        id: crypto.randomUUID(),
        title: row.title,
        author: row.author,
        weight: 'normal',
        source: 'readwise',
        createdAt: now,
        updatedAt: now
      }
      bookByKey.set(key, book)
      newBooks.push(book)
    }
    touchedBooks.add(key)

    const seen = seenTextsByKey.get(key) ?? new Set<string>()
    seenTextsByKey.set(key, seen)
    const normalized = normalize(row.text)
    if (seen.has(normalized)) {
      skipped += 1
      continue
    }
    seen.add(normalized)

    const tags = normalizeTags(['readwise', row.category ?? '', ...row.tags])
    const noteParts = [row.note, row.location ? `Readwise location: ${row.location}` : undefined, row.url].filter(Boolean)

    newQuotes.push({
      id: crypto.randomUUID(),
      text: row.text,
      author: row.author,
      work: row.title,
      source: row.title,
      bookId: book.id,
      tags,
      note: noteParts.length ? noteParts.join('\n') : undefined,
      favorite: false,
      likes: 0,
      createdAt: row.highlightedAt ?? now,
      updatedAt: row.highlightedAt ?? now,
      reviewCount: 0
    })
  }

  return {
    newBooks,
    newQuotes,
    importedCount: newQuotes.length,
    skippedCount: skipped,
    bookCount: touchedBooks.size
  }
}

function readRows(content: string): ReadwiseRow[] {
  const csvRows = parseCsv(content.replace(/^\uFEFF/, ''))
  if (csvRows.length < 2) return []
  const headers = csvRows[0].map(normalizeHeader)

  return csvRows
    .slice(1)
    .filter((row) => row.some((cell) => cell.trim()))
    .map((row) => {
      const get = (aliases: string[]) => valueFor(row, headers, aliases)
      const highlightedAt = parseDate(get(dateAliases))
      return {
        text: get(textAliases),
        title: get(titleAliases),
        author: get(authorAliases) || undefined,
        note: get(noteAliases) || undefined,
        tags: splitTags(get(tagsAliases)),
        category: get(categoryAliases) || undefined,
        location: get(locationAliases) || undefined,
        url: get(urlAliases) || undefined,
        highlightedAt
      }
    })
}

function valueFor(row: string[], headers: string[], aliases: string[]) {
  const normalizedAliases = aliases.map(normalizeHeader)
  const index = headers.findIndex((header) => normalizedAliases.includes(header))
  return index >= 0 ? (row[index] ?? '').trim() : ''
}

function splitTags(value: string) {
  return value
    .split(/[;,]/)
    .map((tag) => tag.trim())
    .filter(Boolean)
}

function parseDate(value: string) {
  if (!value) return undefined
  const time = Date.parse(value)
  return Number.isNaN(time) ? undefined : new Date(time).toISOString()
}

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/[\s-]+/g, '_')
}

function normalize(text: string) {
  return text.replace(/\s+/g, ' ').trim().toLowerCase()
}
