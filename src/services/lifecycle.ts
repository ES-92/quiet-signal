import { quoteStatus, type Quote, type QuoteStatus } from '../types/quote'
import { appendActivity, removeLatestActivity } from './activity'

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

// Stored dates can come from old rows or imports, so every helper here tolerates invalid input: an invalid date
// counts as "now" (due) instead of throwing during render.
function validTime(value: string | undefined): number | undefined {
  if (!value) return undefined
  const time = new Date(value).getTime()
  return Number.isFinite(time) ? time : undefined
}

export function reviewDateFromInterval(days: number, now = new Date()): string {
  const next = Number.isFinite(now.getTime()) ? new Date(now) : new Date()
  const safeDays = Number.isFinite(days) ? Math.min(Math.max(days, 0), maxIntervalDays * 10) : 1
  next.setDate(next.getDate() + safeDays)
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

// Undo of → / ← on the fresh row: puts the review values back and drops the more/less event that action logged
// (it carries the review's timestamp, current.lastReviewedAt), so events logged since stay.
export function restoreReviewPatch(current: Quote, previous: ReviewSnapshot, now = new Date()): Partial<Quote> {
  const reviewedAt = current.lastReviewedAt
  const activity = removeLatestActivity(
    current.activity,
    (event) => (event.type === 'more' || event.type === 'less') && event.at === reviewedAt
  )
  return { ...previous, ...(activity !== current.activity ? { activity } : {}), updatedAt: now.toISOString() }
}

// A favourite never stays away longer than 30 days; everything else keeps the global maximum.
function intervalCap(quote: Pick<Quote, 'favorite'>): number {
  return quote.favorite ? Math.min(maxIntervalDays, favoriteMaxIntervalDays) : maxIntervalDays
}

export function moreOftenPatch(quote: Quote, now = new Date()): Partial<Quote> {
  const next = Math.min(intervalCap(quote), Math.ceil(effectiveInterval(quote) * moreOftenFactor))
  return { ...reviewedPatch(quote, next, now), likes: quote.likes + 1, activity: appendActivity(quote.activity, 'more', now) }
}

export function lessOftenPatch(quote: Quote, now = new Date()): Partial<Quote> {
  const next = Math.min(intervalCap(quote), Math.max(lessOftenMinDays, Math.ceil(effectiveInterval(quote) * lessOftenFactor)))
  return { ...reviewedPatch(quote, next, now), activity: appendActivity(quote.activity, 'less', now) }
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
// An invalid stored date is treated like no date: due now.
export function effectiveDueAt(quote: Quote): string | undefined {
  const dueTime = validTime(quote.nextReviewAt)
  if (dueTime === undefined) return undefined
  if (!quote.favorite || quoteStatus(quote) !== 'signal') return quote.nextReviewAt
  const baseTime = validTime(quote.lastReviewedAt) ?? validTime(quote.createdAt) ?? Date.now()
  const capped = reviewDateFromInterval(favoriteMaxIntervalDays, new Date(baseTime))
  return dueTime <= new Date(capped).getTime() ? quote.nextReviewAt : capped
}

export function restPatch(quote: Quote, now = new Date()): Partial<Quote> {
  return { status: 'rest', snoozedUntil: undefined, updatedAt: now.toISOString(), activity: appendActivity(quote.activity, 'rest', now) }
}

// Undo of ↓ on the fresh row: back to the previous status (signal on Today, inbox on Klären) with the previous snooze,
// without the rest event that ↓ logged (matched by its time).
export function undoRestPatch(
  quote: Quote,
  previousSnooze: string | undefined,
  restedAt: string | undefined,
  now = new Date(),
  previousStatus: Exclude<QuoteStatus, 'rest'> = 'signal'
): Partial<Quote> {
  return {
    status: previousStatus,
    snoozedUntil: previousSnooze,
    activity: removeLatestActivity(quote.activity, (event) => event.type === 'rest' && event.at === restedAt),
    updatedAt: now.toISOString()
  }
}

// A status change from a form (edit or clarify) logs going to rest and waking from it; other moves are not logged.
export function statusActivityPatch(current: Quote, next: QuoteStatus | undefined, now = new Date()): Partial<Quote> {
  const previous = quoteStatus(current)
  if (!next || next === previous) return {}
  if (next === 'rest') return { activity: appendActivity(current.activity, 'rest', now) }
  if (previous === 'rest' && next === 'signal') return { activity: appendActivity(current.activity, 'wake', now) }
  return {}
}

export function wakePatch(quote: Quote, now = new Date()): Partial<Quote> {
  return {
    status: 'signal',
    reviewIntervalDays: 1,
    nextReviewAt: reviewDateFromInterval(1, now),
    snoozedUntil: undefined,
    updatedAt: now.toISOString(),
    activity: appendActivity(quote.activity, 'wake', now)
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
  const createdTime = validTime(quote.createdAt)
  if (createdTime === undefined) return 0
  return Math.max(0, Math.floor((now.getTime() - createdTime) / dayMs))
}
