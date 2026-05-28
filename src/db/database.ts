import Dexie, { type Table } from 'dexie'
import {
  decryptBookFromStorage,
  decryptQuoteFromStorage,
  disableEncryptionRecord,
  encryptBookForStorage,
  encryptQuoteForStorage
} from '../services/security'
import type { Book, BookInput } from '../types/book'
import type { Quote, QuoteInput } from '../types/quote'

class QuietSignalDatabase extends Dexie {
  quotes!: Table<Quote, string>
  books!: Table<Book, string>

  constructor() {
    super('commonplace')
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
  }
}

export const db = new QuietSignalDatabase()

const now = () => new Date().toISOString()

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
  const quotes = await Promise.all(rows.map((quote) => decryptQuoteFromStorage(quote)))
  return quotes.filter((quote): quote is Quote => Boolean(quote)).map(withQuoteDefaults)
}

export async function getQuote(id: string) {
  const quote = await db.quotes.get(id)
  if (!quote) return undefined
  const decrypted = await decryptQuoteFromStorage(quote)
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
  const quotes = await listQuotes()
  const books = await listBooks()
  await db.quotes.clear()
  await db.books.clear()
  await db.quotes.bulkPut(await Promise.all(quotes.map((quote) => encryptQuoteForStorage(quote))))
  await db.books.bulkPut(await Promise.all(books.map((book) => encryptBookForStorage(book))))
}

export async function decryptAllQuotesAndDisable() {
  const quotes = await listQuotes()
  const books = await listBooks()
  await db.quotes.clear()
  await db.books.clear()
  disableEncryptionRecord()
  await db.quotes.bulkPut(quotes.map((quote) => ({ ...quote, tags: normalizeTags(quote.tags) })))
  await db.books.bulkPut(books)
}

export async function listBooks() {
  const rows = await db.books.toArray()
  const books = await Promise.all(rows.map((book) => decryptBookFromStorage(book)))
  return books
    .filter((book): book is Book => Boolean(book))
    .sort((a, b) => a.title.localeCompare(b.title))
}

export async function getBook(id: string) {
  const book = await db.books.get(id)
  return book ? decryptBookFromStorage(book) : undefined
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
