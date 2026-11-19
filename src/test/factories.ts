/// <reference types="vite/client" />
import type { Book } from '../types/book'
import type { Quote } from '../types/quote'

const FIXED_TIMESTAMP = '2026-01-01T09:00:00.000Z'

let quoteCounter = 0
let bookCounter = 0

export function resetFactories(): void {
  quoteCounter = 0
  bookCounter = 0
}

export function makeQuote(overrides: Partial<Quote> = {}): Quote {
  quoteCounter += 1
  return {
    id: `q-${quoteCounter}`,
    text: `Zitat ${quoteCounter}`,
    tags: [],
    favorite: false,
    likes: 0,
    status: 'signal',
    signalStrength: 'normal',
    entryType: 'note',
    createdAt: FIXED_TIMESTAMP,
    updatedAt: FIXED_TIMESTAMP,
    reviewCount: 0,
    ...overrides
  }
}

export function makeBook(overrides: Partial<Book> = {}): Book {
  bookCounter += 1
  return {
    id: `b-${bookCounter}`,
    title: `Buch ${bookCounter}`,
    weight: 'normal',
    createdAt: FIXED_TIMESTAMP,
    updatedAt: FIXED_TIMESTAMP,
    ...overrides
  }
}

const fixtures = import.meta.glob('./fixtures/*', {
  query: '?raw',
  import: 'default',
  eager: true
}) as Record<string, string>

export function readFixture(name: string): string {
  const content = fixtures[`./fixtures/${name}`]
  if (content === undefined) throw new Error(`Fixture nicht gefunden: ${name}`)
  return content
}
