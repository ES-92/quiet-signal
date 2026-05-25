import type { Quote } from '../types/quote'
import { weightMultiplier, type BookWeight } from '../types/book'
import type { DailyMode } from '../store/useSettingsStore'

export type BookWeightMap = Record<string, BookWeight>

const dayMs = 24 * 60 * 60 * 1000

export type ReviewAction = 'read' | 'later'

export function nextReviewDate(quote: Quote, action: ReviewAction) {
  const now = new Date()

  if (action === 'later') {
    return new Date(now.getTime() + 6 * 60 * 60 * 1000).toISOString()
  }

  if (quote.reviewCount === 0) {
    return new Date(now.getTime() + dayMs).toISOString()
  }

  if (quote.reviewCount === 1) {
    return new Date(now.getTime() + 3 * dayMs).toISOString()
  }

  const interval = quote.favorite ? 5 : 7
  return new Date(now.getTime() + interval * dayMs).toISOString()
}

export function applyReview(quote: Quote, action: ReviewAction): Partial<Quote> {
  const timestamp = new Date().toISOString()

  if (action === 'later') {
    return {
      nextReviewAt: nextReviewDate(quote, action),
      updatedAt: timestamp
    }
  }

  return {
    reviewCount: quote.reviewCount + 1,
    lastReviewedAt: timestamp,
    nextReviewAt: nextReviewDate(quote, action),
    updatedAt: timestamp
  }
}

export function selectDailyQuotes(quotes: Quote[], limit = 5) {
  return selectDailyStack(quotes, { limit, mode: 'balanced' })
}

export function selectDailyStack(
  quotes: Quote[],
  options: { limit: number; mode: DailyMode; date?: Date; bookWeights?: BookWeightMap } = {
    limit: 5,
    mode: 'balanced'
  }
) {
  const now = Date.now()
  const baseDate = options.date ?? new Date()
  const weights = options.bookWeights ?? {}
  const dateKey = formatDateKey(baseDate)
  const random = seededRandom(`${dateKey}:${options.limit}:${options.mode}`)

  const endOfToday = new Date(baseDate)
  endOfToday.setHours(23, 59, 59, 999)
  const endOfTodayMs = endOfToday.getTime()

  // Items already read today drop out so the stack empties as you work through
  // it (and so "read" entries don't immediately reappear via the backlog).
  const reviewedToday = (quote: Quote) =>
    Boolean(quote.lastReviewedAt) && formatDateKey(new Date(quote.lastReviewedAt as string)) === dateKey

  const scored = quotes
    .filter((quote) => !reviewedToday(quote))
    .map((quote) => ({
      quote,
      due: !quote.nextReviewAt || new Date(quote.nextReviewAt).getTime() <= now,
      score: stackScore(quote, now, options.mode, random, weights)
    }))

  const due = scored.filter((item) => item.due).sort((a, b) => b.score - a.score)
  // Backlog keeps the daily stack from ever running dry: entries that aren't due
  // until a later day (today's snoozed items are excluded — they return on their
  // own) surface as a refresher when too few are strictly due.
  const backlog = scored
    .filter((item) => !item.due && new Date(item.quote.nextReviewAt as string).getTime() > endOfTodayMs)
    .sort((a, b) => b.score - a.score)

  const ordered = [...due, ...backlog]

  const selected: Quote[] = []
  const usedAuthors = new Set<string>()

  for (const item of ordered) {
    const author = item.quote.author?.toLowerCase().trim()
    // Books marked "often" may surface more than once per stack, so don't
    // dedupe them by author the way we do for everything else.
    const allowRepeatAuthor = weights[item.quote.bookId ?? ''] === 'often'
    if (author && usedAuthors.has(author) && !allowRepeatAuthor && ordered.length > options.limit) {
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

function stackScore(quote: Quote, today: number, mode: DailyMode, random: () => number, weights: BookWeightMap) {
  const reviewScore = scoreQuote(quote, today)
  const likeBonus = Math.min(quote.likes ?? 0, 8) * 35
  const weighted = (reviewScore + likeBonus) * weightMultiplier(weights[quote.bookId ?? ''])
  const randomScore = random() * (mode === 'random' ? 1200 : 180)
  return weighted + randomScore
}

function scoreQuote(quote: Quote, today: number) {
  if (!quote.lastReviewedAt) {
    return 1000 + (quote.favorite ? 80 : 0)
  }

  const daysSinceReview = Math.floor((today - new Date(quote.lastReviewedAt).getTime()) / dayMs)
  return daysSinceReview * 10 + (quote.favorite ? 60 : 0) - quote.reviewCount
}

function formatDateKey(date: Date) {
  return date.toISOString().slice(0, 10)
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
