import type { Quote, QuoteStatus } from '../types/quote'

const reviewHour = 6
const maxIntervalDays = 365
const moreOftenFactor = 1.5
const lessOftenFactor = 4
const lessOftenMinDays = 14
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

export function moreOftenPatch(quote: Quote, now = new Date()): Partial<Quote> {
  const next = Math.min(maxIntervalDays, Math.ceil(effectiveInterval(quote) * moreOftenFactor))
  return { ...reviewedPatch(quote, next, now), likes: quote.likes + 1 }
}

export function lessOftenPatch(quote: Quote, now = new Date()): Partial<Quote> {
  const next = Math.min(maxIntervalDays, Math.max(lessOftenMinDays, Math.ceil(effectiveInterval(quote) * lessOftenFactor)))
  return reviewedPatch(quote, next, now)
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
