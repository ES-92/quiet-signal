import type { Book } from '../types/book'
import type { Quote } from '../types/quote'
import { localDateKey } from '../utils/date'

export type ReflectionPeriod = 'week' | 'month'

// A thought written in the period, with enough of its entry to place it.
export interface ReflectionThought {
  id: string
  text: string
  createdAt: string
  fromNote: boolean
  quoteId: string
  quoteText?: string
  author?: string
  work?: string
}

// One column of the tide strip: a day (week view) or a week clipped to the month (month view).
export interface StripBucket {
  start: Date
  end: Date
  more: number
  less: number
  rest: number
  thought: boolean
}

export interface ReflectionTotals {
  more: number
  less: number
  rest: number
  thoughts: number
}

export interface ReflectionSummary {
  period: ReflectionPeriod
  start: Date
  end: Date
  thoughts: ReflectionThought[]
  strip: StripBucket[]
  totals: ReflectionTotals
}

export function buildReflection(quotes: Quote[], books: Book[], period: ReflectionPeriod, now = new Date()): ReflectionSummary {
  const { start, end } = periodRange(period, now)
  const bookById = new Map(books.map((book) => [book.id, book]))
  const inPeriod = (iso: string) => {
    const time = Date.parse(iso)
    return time >= start.getTime() && time <= end.getTime()
  }

  const thoughts: ReflectionThought[] = []
  for (const quote of quotes) {
    const book = quote.bookId ? bookById.get(quote.bookId) : undefined
    for (const thought of quote.thoughts ?? []) {
      if (!inPeriod(thought.createdAt)) continue
      thoughts.push({
        id: thought.id,
        text: thought.text,
        createdAt: thought.createdAt,
        fromNote: thought.fromNote === true,
        quoteId: quote.id,
        quoteText: quote.text || undefined,
        author: quote.author ?? book?.author,
        work: book?.title ?? quote.work
      })
    }
  }
  thoughts.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))

  const strip = stripBuckets(period, start, end)
  const totals: ReflectionTotals = { more: 0, less: 0, rest: 0, thoughts: thoughts.length }
  const bucketAt = (iso: string) => {
    const time = Date.parse(iso)
    return strip.find((bucket) => time >= bucket.start.getTime() && time <= bucket.end.getTime())
  }

  for (const quote of quotes) {
    for (const event of quote.activity ?? []) {
      const bucket = bucketAt(event.at)
      if (!bucket) continue
      if (event.type === 'thought') bucket.thought = true
      else if (event.type === 'more' || event.type === 'less' || event.type === 'rest') {
        bucket[event.type] += 1
        totals[event.type] += 1
      }
    }
    // Entries from before the log still have dated thoughts; adopted notes are not new thoughts.
    for (const thought of quote.thoughts ?? []) {
      if (thought.fromNote) continue
      const bucket = bucketAt(thought.createdAt)
      if (bucket) bucket.thought = true
    }
  }

  return { period, start, end, thoughts, strip, totals }
}

export interface ReflectionMarkdownLabels {
  title: string
  summary: string
  fromNote: string
}

export function reflectionMarkdown(summary: ReflectionSummary, labels: ReflectionMarkdownLabels) {
  const lines = [`# ${labels.title}`, '', `${localDateKey(summary.start)} - ${localDateKey(summary.end)}`]
  if (labels.summary) lines.push('', labels.summary)

  for (const thought of summary.thoughts) {
    const attribution = [thought.author, thought.work].filter(Boolean).join(', ')
    const heading = [localDateKey(new Date(thought.createdAt)), attribution, thought.fromNote ? labels.fromNote : '']
      .filter(Boolean)
      .join(' · ')
    lines.push('', '---', '', `## ${heading}`, '', thought.text)
    if (thought.quoteText) lines.push('', ...thought.quoteText.split('\n').map((line) => `> ${line}`))
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

  let end: Date
  if (period === 'week') {
    const nextWeekStart = new Date(start)
    nextWeekStart.setDate(nextWeekStart.getDate() + 7)
    end = new Date(nextWeekStart.getTime() - 1)
  } else {
    end = new Date(start.getFullYear(), start.getMonth() + 1, 1, 0, 0, 0, -1)
  }
  return { start, end }
}

// Week: one bucket per day. Month: one per Monday–Sunday week, clipped to the month's first and last day.
function stripBuckets(period: ReflectionPeriod, start: Date, end: Date): StripBucket[] {
  const buckets: StripBucket[] = []
  const cursor = new Date(start)
  while (cursor.getTime() <= end.getTime()) {
    const next = new Date(cursor)
    if (period === 'week') next.setDate(next.getDate() + 1)
    else next.setDate(next.getDate() + (8 - (next.getDay() || 7)))
    const bucketEnd = new Date(Math.min(next.getTime() - 1, end.getTime()))
    buckets.push({ start: new Date(cursor), end: bucketEnd, more: 0, less: 0, rest: 0, thought: false })
    cursor.setTime(next.getTime())
  }
  return buckets
}
