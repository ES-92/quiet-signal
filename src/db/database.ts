import Dexie, { type Table } from 'dexie'
import {
  decryptBookFromStorage,
  decryptQuoteFromStorage,
  disableEncryptionRecord,
  encryptBookForStorage,
  encryptQuoteForStorage,
  isEncryptionUnlocked
} from '../services/security'
import type { Book, BookInput } from '../types/book'
import type { Quote, QuoteInput } from '../types/quote'

class QuietSignalDatabase extends Dexie {
  quotes!: Table<Quote, string>
  books!: Table<Book, string>

  constructor() {
    super('quiet-signal')
    this.version(1).stores({
      quotes: 'id, author, source, favorite, createdAt, updatedAt, nextReviewAt, *tags'
    })
    this.version(2).stores({
      books: 'id, title, weight, createdAt, updatedAt'
    })
    this.version(3).stores({
      quotes: 'id, author, source, favorite, status, signalStrength, createdAt, updatedAt, nextReviewAt, *tags',
      books: 'id, title, weight, createdAt, updatedAt'
    })
    this.version(4).stores({
      quotes: 'id, author, source, favorite, status, signalStrength, entryType, createdAt, updatedAt, nextReviewAt, *tags',
      books: 'id, title, weight, createdAt, updatedAt'
    })
    this.version(5).stores({
      quotes: 'id, author, source, favorite, status, signalStrength, entryType, snoozedUntil, deletedAt, createdAt, updatedAt, nextReviewAt, *tags',
      books: 'id, title, weight, createdAt, updatedAt'
    })
  }
}

export const db = new QuietSignalDatabase()

const now = () => new Date().toISOString()

/**
 * Decrypts one stored row. A row that cannot be decrypted (corrupt payload, wrong key)
 * is reported with a single warning and treated like an unreadable row (null), so one
 * bad row cannot make the whole library unreadable.
 */
const rewriteAbortMessage = 'Some entries could not be decrypted; aborting to avoid data loss.'

async function safeDecryptQuote(row: Quote) {
  try {
    return await decryptQuoteFromStorage(row)
  } catch {
    console.warn(`Quiet Signal: could not decrypt quote ${row.id}; skipping it.`)
    return null
  }
}

async function safeDecryptBook(row: Book) {
  try {
    return await decryptBookFromStorage(row)
  } catch {
    console.warn(`Quiet Signal: could not decrypt book ${row.id}; skipping it.`)
    return null
  }
}

/**
 * Loads every row decrypted for a bulk rewrite (encrypt-all / decrypt-all). These clear
 * the tables before rewriting, so any row that cannot be read must abort the operation
 * instead of being silently dropped.
 */
async function loadAllForRewrite() {
  if (!isEncryptionUnlocked()) throw new Error('Encryption is locked.')
  const quoteRows = await db.quotes.toArray()
  const bookRows = await db.books.toArray()
  let quotes: (Quote | null)[]
  let books: (Book | null)[]
  try {
    quotes = await Promise.all(quoteRows.map((row) => decryptQuoteFromStorage(row)))
    books = await Promise.all(bookRows.map((row) => decryptBookFromStorage(row)))
  } catch {
    throw new Error(rewriteAbortMessage)
  }
  if (quotes.some((quote) => !quote) || books.some((book) => !book)) throw new Error(rewriteAbortMessage)
  return {
    quotes: quotes.filter((quote): quote is Quote => Boolean(quote)).map(withQuoteDefaults),
    books: books.filter((book): book is Book => Boolean(book))
  }
}

function withQuoteDefaults(quote: Quote): Quote {
  return {
    ...quote,
    likes: quote.likes ?? 0,
    status: quote.status ?? 'signal',
    signalStrength: quote.signalStrength ?? 'normal',
    entryType: quote.entryType ?? 'note',
    people: quote.people ?? []
  }
}

export async function listQuotes() {
  const rows = await db.quotes.orderBy('createdAt').reverse().toArray()
  const quotes = await Promise.all(rows.map((quote) => safeDecryptQuote(quote)))
  return quotes
    .filter((quote): quote is Quote => Boolean(quote))
    .filter((quote) => !quote.deletedAt)
    .map(withQuoteDefaults)
}

export async function listTrashed() {
  const rows = await db.quotes.toArray()
  const quotes = await Promise.all(rows.map((quote) => safeDecryptQuote(quote)))
  return quotes
    .filter((quote): quote is Quote => Boolean(quote))
    .filter((quote) => Boolean(quote.deletedAt))
    .map(withQuoteDefaults)
    .sort((a, b) => (b.deletedAt as string).localeCompare(a.deletedAt as string))
}

export async function emptyTrash() {
  const trashed = await listTrashed()
  await db.quotes.bulkDelete(trashed.map((quote) => quote.id))
}

export async function getQuote(id: string) {
  const quote = await db.quotes.get(id)
  if (!quote) return undefined
  const decrypted = await safeDecryptQuote(quote)
  return decrypted ? withQuoteDefaults(decrypted) : undefined
}

export async function createQuote(input: QuoteInput) {
  const timestamp = now()
  const quote: Quote = {
    ...input,
    id: crypto.randomUUID(),
    tags: normalizeTags(input.tags),
    favorite: input.favorite ?? false,
    likes: 0,
    status: input.status ?? 'signal',
    signalStrength: input.signalStrength ?? 'normal',
    entryType: input.entryType ?? 'note',
    people: input.people ?? [],
    createdAt: timestamp,
    updatedAt: timestamp,
    reviewCount: 0
  }

  await db.quotes.add(await encryptQuoteForStorage(quote))
  return quote
}

export async function upsertQuotes(quotes: Quote[]) {
  await db.quotes.bulkPut(
    await Promise.all(
      quotes.map((quote) =>
        encryptQuoteForStorage({
          ...withQuoteDefaults(quote),
          tags: normalizeTags(quote.tags),
          people: normalizePeople(quote.people)
        })
      )
    )
  )
}

export async function updateQuote(id: string, patch: Partial<Quote>) {
  const timestamp = now()
  const current = await getQuote(id)
  if (!current) return undefined
  const nextQuote = {
    ...current,
    ...patch,
    tags: patch.tags ? normalizeTags(patch.tags) : current.tags,
    people: patch.people ? normalizePeople(patch.people) : current.people,
    updatedAt: timestamp
  }
  await db.quotes.put(await encryptQuoteForStorage(nextQuote))
  return getQuote(id)
}

export function normalizePeople(people: string[] = []) {
  return Array.from(
    new Set(
      people
        .flatMap((person) => person.split(','))
        .map((person) => person.trim())
        .filter(Boolean)
    )
  )
}

export async function deleteQuote(id: string) {
  await db.quotes.delete(id)
}

export async function clearQuotes() {
  await db.quotes.clear()
}

export async function clearBooks() {
  await db.books.clear()
}

export async function encryptAllQuotes() {
  const { quotes, books } = await loadAllForRewrite()
  // All WebCrypto work happens before the transaction (no non-Dexie awaits inside it);
  // the tables are only cleared and rewritten atomically, so a failure keeps the old rows.
  const encryptedQuotes = await Promise.all(quotes.map((quote) => encryptQuoteForStorage(quote)))
  const encryptedBooks = await Promise.all(books.map((book) => encryptBookForStorage(book)))
  await db.transaction('rw', db.quotes, db.books, async () => {
    await db.quotes.clear()
    await db.books.clear()
    await db.quotes.bulkPut(encryptedQuotes)
    await db.books.bulkPut(encryptedBooks)
  })
}

export async function decryptAllQuotesAndDisable() {
  const { quotes, books } = await loadAllForRewrite()
  const plainQuotes = quotes.map((quote) => ({ ...quote, tags: normalizeTags(quote.tags) }))
  await db.transaction('rw', db.quotes, db.books, async () => {
    await db.quotes.clear()
    await db.books.clear()
    await db.quotes.bulkPut(plainQuotes)
    await db.books.bulkPut(books)
  })
  // Only after the plaintext rows are committed may the encryption record be removed.
  disableEncryptionRecord()
}

export async function listBooks() {
  const rows = await db.books.toArray()
  const books = await Promise.all(rows.map((book) => safeDecryptBook(book)))
  return books
    .filter((book): book is Book => Boolean(book))
    .sort((a, b) => a.title.localeCompare(b.title))
}

export async function getBook(id: string) {
  const book = await db.books.get(id)
  return book ? (await safeDecryptBook(book)) ?? undefined : undefined
}

export async function createBook(input: BookInput) {
  const timestamp = now()
  const book: Book = {
    ...input,
    id: crypto.randomUUID(),
    title: input.title.trim(),
    author: input.author?.trim() || undefined,
    weight: input.weight ?? 'normal',
    createdAt: timestamp,
    updatedAt: timestamp
  }

  await db.books.add(await encryptBookForStorage(book))
  return book
}

export async function updateBook(id: string, patch: Partial<Book>) {
  const current = await getBook(id)
  if (!current) return undefined
  const nextBook: Book = { ...current, ...patch, updatedAt: now() }
  await db.books.put(await encryptBookForStorage(nextBook))
  return getBook(id)
}

export async function deleteBook(id: string) {
  await db.books.delete(id)
}

export async function upsertBooks(books: Book[]) {
  await db.books.bulkPut(await Promise.all(books.map((book) => encryptBookForStorage(book))))
}

export function normalizeTags(tags: string[]) {
  return Array.from(
    new Set(
      tags
        .flatMap((tag) => tag.split(','))
        .map((tag) => tag.trim().toLowerCase())
        .filter(Boolean)
    )
  )
}
