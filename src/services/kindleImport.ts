import { bookKey, type Book } from '../types/book'
import type { Quote } from '../types/quote'

export interface KindleClipping {
  title: string
  author?: string
  text: string
  addedAt?: string
}

export interface KindleImportPlan {
  newBooks: Book[]
  newQuotes: Quote[]
  importedCount: number
  skippedCount: number
  bookCount: number
}

const SEPARATOR = /^={6,}$/

// Kindle localises the "Added on" line; cover the common UI languages.
const ADDED_ON = /(?:Added on|Hinzugefügt am|Ajouté le|Añadido el|Aggiunto il|追加日)[:\s]+(.*)$/i

/** Parse the raw contents of a Kindle `My Clippings.txt` file into clippings. */
export function parseKindleClippings(content: string): KindleClipping[] {
  const blocks = content
    // eslint-disable-next-line no-irregular-whitespace -- strips the U+FEFF BOM Kindle prepends to My Clippings.txt
    .replace(/^﻿/, '')
    // Windows (CRLF) and old-Mac (CR) line endings -> LF
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .reduce<string[][]>(
      (acc, line) => {
        if (SEPARATOR.test(line.trim())) {
          acc.push([])
        } else {
          acc[acc.length - 1].push(line)
        }
        return acc
      },
      [[]]
    )

  const clippings: KindleClipping[] = []

  for (const lines of blocks) {
    while (lines.length && !lines[0].trim()) lines.shift()
    if (lines.length < 2) continue

    const { title, author } = parseTitleAuthor(lines[0].trim())
    if (!title) continue

    const metaIndex = lines.findIndex((line) => line.trim().startsWith('-'))
    const meta = metaIndex >= 0 ? lines[metaIndex] : ''
    const text = lines
      .slice((metaIndex >= 0 ? metaIndex : 0) + 1)
      .join('\n')
      .trim()

    if (!text) continue // bookmarks and empty notes carry no text

    clippings.push({ title, author, text, addedAt: parseAddedDate(meta) })
  }

  return clippings
}

/**
 * Build the books and quotes to persist from a clippings file, matching against
 * what already exists so re-importing the same file is idempotent. Duplicate and
 * superseded (extended) highlights within a single book are collapsed.
 */
export function buildKindleImport(content: string, existingBooks: Book[], existingQuotes: Quote[]): KindleImportPlan {
  const clippings = parseKindleClippings(content)
  const now = new Date().toISOString()

  // bookKey -> Book (existing or freshly created in this run)
  const bookByKey = new Map<string, Book>()
  for (const book of existingBooks) bookByKey.set(bookKey(book.title, book.author), book)

  // Texts already stored per book, so a second import doesn't duplicate them.
  const seenTextsByKey = new Map<string, Set<string>>()
  const idToKey = new Map(existingBooks.map((book) => [book.id, bookKey(book.title, book.author)]))
  for (const quote of existingQuotes) {
    const key = (quote.bookId && idToKey.get(quote.bookId)) || bookKey(quote.work ?? '', quote.author)
    if (!seenTextsByKey.has(key)) seenTextsByKey.set(key, new Set())
    seenTextsByKey.get(key)!.add(normalize(quote.text))
  }

  const newBooks: Book[] = []
  const newQuotes: Quote[] = []
  let skipped = 0
  const touchedBooks = new Set<string>()
  // Quotes created in this run, per book, so a later longer highlight can replace them.
  const runQuotesByKey = new Map<string, Map<string, Quote>>()

  for (const clip of clippings) {
    const key = bookKey(clip.title, clip.author)

    let book = bookByKey.get(key)
    if (!book) {
      book = {
        id: crypto.randomUUID(),
        title: clip.title,
        author: clip.author,
        weight: 'normal',
        source: 'kindle',
        createdAt: now,
        updatedAt: now
      }
      bookByKey.set(key, book)
      newBooks.push(book)
    }
    touchedBooks.add(key)

    const seen = seenTextsByKey.get(key) ?? new Set<string>()
    seenTextsByKey.set(key, seen)

    const normalized = normalize(clip.text)
    const superseded: string[] = []
    if (isDuplicateOrSuperseded(normalized, seen, superseded)) {
      skipped += 1
      continue
    }
    seen.add(normalized)

    // Drop shorter highlights of this run that the incoming one extends (counted as skipped).
    const runQuotes = runQuotesByKey.get(key) ?? new Map<string, Quote>()
    runQuotesByKey.set(key, runQuotes)
    for (const shorter of superseded) {
      const stale = runQuotes.get(shorter)
      if (!stale) continue // came from existing storage, not from this run
      newQuotes.splice(newQuotes.indexOf(stale), 1)
      runQuotes.delete(shorter)
      skipped += 1
    }

    const quote: Quote = {
      id: crypto.randomUUID(),
      text: clip.text,
      author: clip.author,
      work: clip.title,
      source: clip.title,
      bookId: book.id,
      tags: [],
      favorite: false,
      likes: 0,
      status: 'signal',
      signalStrength: 'normal',
      entryType: 'book_quote',
      createdAt: clip.addedAt ?? now,
      updatedAt: clip.addedAt ?? now,
      reviewCount: 0
    }
    newQuotes.push(quote)
    runQuotes.set(normalized, quote)
  }

  return {
    newBooks,
    newQuotes,
    importedCount: newQuotes.length,
    skippedCount: skipped,
    bookCount: touchedBooks.size
  }
}

function isDuplicateOrSuperseded(normalized: string, seen: Set<string>, superseded: string[]) {
  for (const existing of seen) {
    if (existing === normalized) return true
    // Extended highlights: keep only the longer one. If the incoming text is a
    // substring of something seen, it's superseded; if it contains a seen text,
    // drop the shorter seen one (reported via `superseded`) and accept the longer incoming one.
    if (existing.includes(normalized)) return true
    if (normalized.includes(existing)) {
      seen.delete(existing)
      superseded.push(existing)
    }
  }
  return false
}

function parseTitleAuthor(line: string): { title: string; author?: string } {
  const match = line.match(/^(.*)\(([^()]*)\)\s*$/)
  if (match && match[1].trim()) {
    return { title: match[1].trim(), author: tidyAuthor(match[2].trim()) }
  }
  return { title: line.trim(), author: undefined }
}

// Kindle stores authors as "Last, First"; flip to "First Last" for display.
function tidyAuthor(author: string) {
  if (!author) return undefined
  const parts = author.split(',')
  if (parts.length === 2 && parts[0].trim() && parts[1].trim()) {
    return `${parts[1].trim()} ${parts[0].trim()}`
  }
  return author
}

function parseAddedDate(metaLine: string): string | undefined {
  const match = metaLine.match(ADDED_ON)
  if (!match) return undefined
  const german = parseGermanKindleDate(match[1])
  if (german) return german
  const time = Date.parse(match[1].replace(/,/g, ''))
  return Number.isNaN(time) ? undefined : new Date(time).toISOString()
}

const GERMAN_MONTHS: Record<string, number> = {
  januar: 0,
  februar: 1,
  märz: 2,
  maerz: 2,
  april: 3,
  mai: 4,
  juni: 5,
  juli: 6,
  august: 7,
  september: 8,
  oktober: 9,
  november: 10,
  dezember: 11
}

// "[Wochentag][,] <d>. <Monatsname> <yyyy> <HH:mm[:ss]>", interpreted as local time.
const GERMAN_DATE = /^(?:[a-zäöüß]+,?\s+)?(\d{1,2})\.\s*([a-zäöüß]+)\s+(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?$/i

function parseGermanKindleDate(value: string): string | undefined {
  const match = value.trim().match(GERMAN_DATE)
  if (!match) return undefined
  const month = GERMAN_MONTHS[match[2].toLowerCase()]
  if (month === undefined) return undefined
  const [year, day, hours, minutes, seconds] = [match[3], match[1], match[4], match[5], match[6] ?? '0'].map(Number)
  const date = new Date(year, month, day, hours, minutes, seconds)
  // Reject overflowing values (e.g. 31. Februar) instead of silently rolling over.
  if (date.getFullYear() !== year || date.getMonth() !== month || date.getDate() !== day) return undefined
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString()
}

function normalize(text: string) {
  return text.replace(/\s+/g, ' ').trim().toLowerCase()
}
