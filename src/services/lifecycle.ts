import { quoteStatus, type Quote, type QuoteStatus } from '../types/quote'

const reviewHour = 6
const maxIntervalDays = 365
const moreOftenFactor = 1.5
const lessOftenFactor = 4
const lessOftenMinDays = 14
export const favoriteMaxIntervalDays = 30
const dayMs = 24 * 60 * 60 * 1000

export function effectiveInterval(quote: Pick<Quote, 'reviewIntervalDays' | 'reviewCount'>): number {
  if (quote.reviewIntervalDays !== undefined) return quote.reviewIntervalDays
  if (quote.reviewCount <= 0) return 1
  if (quote.reviewCount === 1) return 3
  return 7
}

export function reviewDateFromInterval(days: number, now = new Date()): string {
  const next = new Date(now)
  next.setDate(next.getDate() + days)
  next.setHours(reviewHour, 0, 0, 0)
  return next.toISOString()
}

function reviewedPatch(quote: Quote, intervalDays: number, now: Date): Partial<Quote> {
  const timestamp = now.toISOString()
  return {
    reviewIntervalDays: intervalDays,
    nextReviewAt: reviewDateFromInterval(intervalDays, now),
    reviewCount: quote.reviewCount + 1,
    lastReviewedAt: timestamp,
    updatedAt: timestamp
  }
}

// The review bookkeeping a → or ← changes, so an undo can put it back exactly (undefined values included).
export type ReviewSnapshot = Pick<Quote, 'reviewIntervalDays' | 'nextReviewAt' | 'reviewCount' | 'lastReviewedAt' | 'likes'>

export function reviewSnapshot(quote: Quote): ReviewSnapshot {
  return {
    reviewIntervalDays: quote.reviewIntervalDays,
    nextReviewAt: quote.nextReviewAt,
    reviewCount: quote.reviewCount,
    lastReviewedAt: quote.lastReviewedAt,
    likes: quote.likes
  }
}

export function restoreReviewPatch(previous: ReviewSnapshot, now = new Date()): Partial<Quote> {
  return { ...previous, updatedAt: now.toISOString() }
}

// A favourite never stays away longer than 30 days; everything else keeps the global maximum.
function intervalCap(quote: Pick<Quote, 'favorite'>): number {
  return quote.favorite ? Math.min(maxIntervalDays, favoriteMaxIntervalDays) : maxIntervalDays
}

export function moreOftenPatch(quote: Quote, now = new Date()): Partial<Quote> {
  const next = Math.min(intervalCap(quote), Math.ceil(effectiveInterval(quote) * moreOftenFactor))
  return { ...reviewedPatch(quote, next, now), likes: quote.likes + 1 }
}

export function lessOftenPatch(quote: Quote, now = new Date()): Partial<Quote> {
  const next = Math.min(intervalCap(quote), Math.max(lessOftenMinDays, Math.ceil(effectiveInterval(quote) * lessOftenFactor)))
  return reviewedPatch(quote, next, now)
}

// Toggling the heart. Becoming a favourite pulls a review that is more than 30 days away in to day 30 (06:00)
// and caps a longer stored interval; unfavouriting only clears the flag.
export function favoriteTogglePatch(quote: Quote, now = new Date()): Partial<Quote> {
  const timestamp = now.toISOString()
  if (quote.favorite) return { favorite: false, updatedAt: timestamp }
  return { favorite: true, updatedAt: timestamp, ...favoriteCapPatch(quote, now) }
}

// The schedule part of becoming a favourite, for every write path that can set the flag (heart, edit form).
export function favoriteCapPatch(quote: Quote, now = new Date()): Partial<Quote> {
  const patch: Partial<Quote> = {}
  // Rest and noise have no due date that matters; wake and clarify set a fresh schedule anyway.
  if (quoteStatus(quote) !== 'signal') return patch
  const latest = reviewDateFromInterval(favoriteMaxIntervalDays, now)
  if (quote.nextReviewAt && new Date(quote.nextReviewAt).getTime() > new Date(latest).getTime()) patch.nextReviewAt = latest
  if (quote.reviewIntervalDays !== undefined && quote.reviewIntervalDays > favoriteMaxIntervalDays) {
    patch.reviewIntervalDays = favoriteMaxIntervalDays
  }
  return patch
}

// When a signal is really due. A favourite is never due later than 30 days after its last review (or creation),
// even if an old or imported row stores a date further away. Stored data is not rewritten.
export function effectiveDueAt(quote: Quote): string | undefined {
  if (!quote.favorite || quoteStatus(quote) !== 'signal') return quote.nextReviewAt
  const capped = reviewDateFromInterval(favoriteMaxIntervalDays, new Date(quote.lastReviewedAt ?? quote.createdAt))
  if (!quote.nextReviewAt) return undefined
  return new Date(quote.nextReviewAt).getTime() <= new Date(capped).getTime() ? quote.nextReviewAt : capped
}

export function restPatch(_quote: Quote, now = new Date()): Partial<Quote> {
  return { status: 'rest', snoozedUntil: undefined, updatedAt: now.toISOString() }
}

export function wakePatch(_quote: Quote, now = new Date()): Partial<Quote> {
  return {
    status: 'signal',
    reviewIntervalDays: 1,
    nextReviewAt: reviewDateFromInterval(1, now),
    snoozedUntil: undefined,
    updatedAt: now.toISOString()
  }
}

export function statusChangePatch(previous: QuoteStatus, next: QuoteStatus, now = new Date()): Partial<Quote> {
  if (next === 'signal' && previous !== 'signal') {
    return {
      reviewIntervalDays: 1,
      nextReviewAt: reviewDateFromInterval(1, now),
      snoozedUntil: undefined
    }
  }
  if (next === 'rest') return { snoozedUntil: undefined }
  return {}
}

export function daysUnclarified(quote: Pick<Quote, 'createdAt'>, now = new Date()): number {
  return Math.max(0, Math.floor((now.getTime() - new Date(quote.createdAt).getTime()) / dayMs))
}
