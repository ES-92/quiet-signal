import type { Book } from '../types/book'
import type { Quote } from '../types/quote'

export interface BookMergeSuggestion {
  key: string
  primary: Book
  duplicates: Book[]
  books: Book[]
  quoteCount: number
}

export function findBookMergeSuggestions(books: Book[], quotes: Quote[]): BookMergeSuggestion[] {
  const groups = new Map<string, Book[]>()
  for (const book of books) {
    const key = normalizedBookKey(book)
    const group = groups.get(key) ?? []
    group.push(book)
    groups.set(key, group)
  }

  return Array.from(groups.entries())
    .filter(([, group]) => group.length > 1)
    .map(([key, group]) => {
      const primary = choosePrimaryBook(group, quotes)
      const ids = new Set(group.map((book) => book.id))
      return {
        key,
        primary,
        duplicates: group.filter((book) => book.id !== primary.id),
        books: group,
        quoteCount: quotes.filter((quote) => quote.bookId && ids.has(quote.bookId)).length
      }
    })
    .sort((a, b) => b.quoteCount - a.quoteCount)
}

export function normalizedBookKey(book: Pick<Book, 'title' | 'author'>) {
  return `${normalizeBookText(book.title)}::${normalizeBookText(book.author ?? '')}`
}

export function shouldUpdateSourceToBookTitle(quote: Quote, duplicate: Book) {
  return !quote.source || quote.source === quote.work || quote.source === duplicate.title
}

function choosePrimaryBook(books: Book[], quotes: Quote[]) {
  const quoteCounts = new Map<string, number>()
  for (const quote of quotes) {
    if (quote.bookId) quoteCounts.set(quote.bookId, (quoteCounts.get(quote.bookId) ?? 0) + 1)
  }

  return [...books].sort((a, b) => {
    const identityDiff = scoreBookIdentity(b, quoteCounts.get(b.id) ?? 0) - scoreBookIdentity(a, quoteCounts.get(a.id) ?? 0)
    if (identityDiff) return identityDiff
    return a.createdAt.localeCompare(b.createdAt)
  })[0]
}

function normalizeBookText(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[''`´’‘]/g, '')
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/gi, ' ')
    .trim()
    .toLowerCase()
}

function scoreTitle(title: string) {
  let score = title.length
  if (/['’]/.test(title)) score += 8
  if (/[A-Z]/.test(title.slice(1))) score += 2
  return score
}

function scoreBookIdentity(book: Book, quoteCount: number) {
  const sourceScore = book.source === 'readwise' || book.source === 'kindle' ? 2 : 0
  const authorScore = book.author ? 6 : 0
  const weightScore = book.weight === 'often' ? 4 : book.weight === 'normal' ? 2 : 0
  return scoreTitle(book.title) * 3 + authorScore + weightScore + sourceScore + Math.min(quoteCount, 12)
}
