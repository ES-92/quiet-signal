import type { Book } from '../types/book'
import { entryType, quoteStatus, signalStrength, type Quote } from '../types/quote'

export type ReflectionPeriod = 'week' | 'month'

export interface ReflectionMetric {
  key: string
  label: string
  count: number
}

export interface ReflectionSummary {
  period: ReflectionPeriod
  start: Date
  end: Date
  entries: Quote[]
  signals: Quote[]
  noise: Quote[]
  topSignal?: Quote
  topTags: ReflectionMetric[]
  topBooks: ReflectionMetric[]
  topPlaces: ReflectionMetric[]
  topTypes: ReflectionMetric[]
  topTime?: ReflectionMetric
}

const dayMs = 24 * 60 * 60 * 1000

export function buildReflection(quotes: Quote[], books: Book[], period: ReflectionPeriod, now = new Date()): ReflectionSummary {
  const { start, end } = periodRange(period, now)
  const bookById = new Map(books.map((book) => [book.id, book]))
  const entries = quotes
    .filter((quote) => {
      if (isSavedReflection(quote)) return false
      const date = entryDate(quote)
      return date >= start.getTime() && date <= end.getTime()
    })
    .sort((a, b) => entryDate(b) - entryDate(a))
  const signals = entries.filter((quote) => quoteStatus(quote) === 'signal')
  const noise = entries.filter((quote) => quoteStatus(quote) === 'inbox')

  return {
    period,
    start,
    end,
    entries,
    signals,
    noise,
    topSignal: chooseTopSignal(signals),
    topTags: topMetrics(entries.flatMap((quote) => quote.tags), 4),
    topBooks: topMetrics(
      entries.flatMap((quote) => {
        if (quote.bookId) {
          const book = bookById.get(quote.bookId)
          if (book) return [book.title]
        }
        return quote.work ? [quote.work] : []
      }),
      3
    ),
    topPlaces: topMetrics(entries.flatMap((quote) => (quote.locationName ? [quote.locationName] : [])), 3),
    topTypes: topMetrics(entries.map((quote) => entryType(quote)), 4),
    topTime: topMetrics(entries.map((quote) => timeBucket(entryDate(quote))), 1)[0]
  }
}

export function reflectionMarkdown(summary: ReflectionSummary, letter: string) {
  const lines = [
    `# ${summary.period === 'week' ? 'Weekly' : 'Monthly'} Reflection`,
    '',
    `${formatDate(summary.start)} - ${formatDate(summary.end)}`,
    '',
    letter,
    '',
    `Entries: ${summary.entries.length}`,
    `Signals: ${summary.signals.length}`,
    `Noise: ${summary.noise.length}`
  ]

  if (summary.topSignal) {
    lines.push('', '## Top signal', quoteLine(summary.topSignal))
  }
  if (summary.topTags.length) {
    lines.push('', '## Tags', summary.topTags.map((tag) => `- ${tag.label} (${tag.count})`).join('\n'))
  }
  if (summary.topBooks.length) {
    lines.push('', '## Books', summary.topBooks.map((book) => `- ${book.label} (${book.count})`).join('\n'))
  }
  if (summary.topPlaces.length) {
    lines.push('', '## Places', summary.topPlaces.map((place) => `- ${place.label} (${place.count})`).join('\n'))
  }

  return lines.join('\n')
}

export function periodRange(period: ReflectionPeriod, now = new Date()) {
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)

  if (period === 'week') {
    const day = start.getDay() || 7
    start.setDate(start.getDate() - day + 1)
  } else {
    start.setDate(1)
  }

  const end = period === 'week' ? new Date(start.getTime() + 7 * dayMs - 1) : new Date(start.getFullYear(), start.getMonth() + 1, 1, 0, 0, 0, -1)
  return { start, end }
}

function chooseTopSignal(signals: Quote[]) {
  return [...signals].sort((a, b) => signalScore(b) - signalScore(a))[0]
}

function signalScore(quote: Quote) {
  const strengthScore = signalStrength(quote) === 'strong' ? 8 : signalStrength(quote) === 'normal' ? 4 : 1
  return (quote.likes ?? 0) * 5 + (quote.favorite ? 10 : 0) + strengthScore + Math.min(quote.reviewCount ?? 0, 6)
}

function topMetrics(values: string[], limit: number): ReflectionMetric[] {
  const counts = new Map<string, ReflectionMetric>()
  for (const rawValue of values) {
    const label = normalizeLabel(rawValue)
    if (!label) continue
    const key = label.toLowerCase()
    const current = counts.get(key)
    counts.set(key, { key, label: current?.label ?? label, count: (current?.count ?? 0) + 1 })
  }
  return Array.from(counts.values())
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, limit)
}

function isSavedReflection(quote: Quote) {
  return quote.tags.includes('reflection') && quote.source === 'Quiet Signal'
}

function normalizeLabel(value: string) {
  return value.trim().replace(/\s+/g, ' ')
}

function entryDate(quote: Quote) {
  const raw = quote.occurredAt || quote.createdAt
  const timestamp = new Date(raw).getTime()
  return Number.isFinite(timestamp) ? timestamp : new Date(quote.createdAt).getTime()
}

function timeBucket(timestamp: number): 'morning' | 'afternoon' | 'evening' | 'night' {
  const hour = new Date(timestamp).getHours()
  if (hour < 5) return 'night'
  if (hour < 12) return 'morning'
  if (hour < 18) return 'afternoon'
  if (hour < 22) return 'evening'
  return 'night'
}

function quoteLine(quote: Quote) {
  const attribution = [quote.author, quote.work].filter(Boolean).join(', ')
  return `> ${quote.text || quote.note || 'Untitled signal'}${attribution ? `\n\n- ${attribution}` : ''}`
}

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10)
}
