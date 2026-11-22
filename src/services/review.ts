import { quoteStatus, isSnoozed, type Quote } from '../types/quote'
import { localDateKey } from '../utils/date'

const dayMs = 24 * 60 * 60 * 1000

const snoozeHour = 6

export function nextMorningISO(now = new Date()): string {
  const next = new Date(now)
  next.setDate(next.getDate() + 1)
  next.setHours(snoozeHour, 0, 0, 0)
  return next.toISOString()
}

export function selectDailyStack(
  quotes: Quote[],
  options: { limit: number; date?: Date } = { limit: 5 }
) {
  const now = Date.now()
  const baseDate = options.date ?? new Date()
  const dateKey = localDateKey(baseDate)
  const random = seededRandom(`${dateKey}:${options.limit}`)

  // Items already read today drop out so the stack empties as you work through it.
  const reviewedToday = (quote: Quote) =>
    Boolean(quote.lastReviewedAt) && localDateKey(new Date(quote.lastReviewedAt as string)) === dateKey

  // Only due signals: the stack is never padded from the backlog, so it can be empty.
  const ordered = quotes
    .filter((quote) => quoteStatus(quote) === 'signal')
    .filter((quote) => !quote.deletedAt)
    .filter((quote) => !isSnoozed(quote, now))
    .filter((quote) => !reviewedToday(quote))
    .filter((quote) => !quote.nextReviewAt || new Date(quote.nextReviewAt).getTime() <= now)
    .map((quote) => ({ quote, score: stackScore(quote, now, random) }))
    .sort((a, b) => b.score - a.score)

  const selected: Quote[] = []
  const usedAuthors = new Set<string>()

  for (const item of ordered) {
    const author = item.quote.author?.toLowerCase().trim()
    if (author && usedAuthors.has(author) && ordered.length > options.limit) {
      continue
    }

    selected.push(item.quote)
    if (author) usedAuthors.add(author)
    if (selected.length === options.limit) return selected
  }

  for (const item of ordered) {
    if (!selected.some((quote) => quote.id === item.quote.id)) {
      selected.push(item.quote)
      if (selected.length === options.limit) break
    }
  }

  return selected
}

function stackScore(quote: Quote, today: number, random: () => number) {
  const reviewScore = scoreQuote(quote, today)
  const likeBonus = Math.min(quote.likes ?? 0, 8) * 35
  const randomScore = random() * 180
  return reviewScore + likeBonus + randomScore
}

// Browsing shuffles every live signal, independent of due date, snooze and today's reviews.
export function selectBrowseStack(quotes: Quote[], options: { limit: number; seed: string }): Quote[] {
  const random = seededRandom(options.seed)
  const pool = quotes.filter((quote) => quoteStatus(quote) === 'signal' && !quote.deletedAt)
  // Fisher-Yates with the seeded generator keeps the order stable per seed.
  for (let index = pool.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1))
    ;[pool[index], pool[swap]] = [pool[swap], pool[index]]
  }
  return pool.slice(0, options.limit)
}

function scoreQuote(quote: Quote, today: number) {
  if (!quote.lastReviewedAt) {
    return 1000 + (quote.favorite ? 80 : 0)
  }

  const daysSinceReview = Math.floor((today - new Date(quote.lastReviewedAt).getTime()) / dayMs)
  return daysSinceReview * 10 + (quote.favorite ? 60 : 0) - quote.reviewCount
}

function seededRandom(seed: string) {
  let hash = 2166136261
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }

  return () => {
    hash += 0x6d2b79f5
    let next = hash
    next = Math.imul(next ^ (next >>> 15), next | 1)
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61)
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296
  }
}
