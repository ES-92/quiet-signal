import type { Quote, QuoteFilters } from '../types/quote'

export const emptyFilters: QuoteFilters = {
  query: '',
  tag: '',
  author: '',
  source: '',
  book: '',
  favoritesOnly: false
}

export function filterQuotes(quotes: Quote[], filters: QuoteFilters) {
  const query = filters.query.trim().toLowerCase()

  return quotes.filter((quote) => {
    if (filters.favoritesOnly && !quote.favorite) return false
    if (filters.tag && !quote.tags.includes(filters.tag)) return false
    if (filters.author && quote.author !== filters.author) return false
    if (filters.source && quote.source !== filters.source) return false
    if (filters.book && quote.bookId !== filters.book) return false
    if (!query) return true

    return [
      quote.text,
      quote.author,
      quote.work,
      quote.source,
      quote.year,
      quote.note,
      quote.tags.join(' ')
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(query)
  })
}

export function getFilterOptions(quotes: Quote[]) {
  return {
    tags: unique(quotes.flatMap((quote) => quote.tags)),
    authors: unique(quotes.map((quote) => quote.author).filter(Boolean) as string[]),
    sources: unique(quotes.map((quote) => quote.source).filter(Boolean) as string[])
  }
}

function unique(values: string[]) {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b))
}
