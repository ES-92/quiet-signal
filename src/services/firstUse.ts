import { localDateKey } from '../utils/date'

export const firstUseKey = 'quiet-signal-first-use'

const dateKeyPattern = /^\d{4}-\d{2}-\d{2}$/

/** Remembers the local date of the first start; later calls keep the original date. */
export function ensureFirstUse(now: Date = new Date()): void {
  const stored = localStorage.getItem(firstUseKey)
  if (stored && dateKeyPattern.test(stored)) return
  localStorage.setItem(firstUseKey, localDateKey(now))
}

/** True once the local calendar date is later than the day of first use (the second day and beyond). */
export function isSecondDayOrLater(now: Date = new Date()): boolean {
  const stored = localStorage.getItem(firstUseKey)
  if (!stored || !dateKeyPattern.test(stored)) return false
  return localDateKey(now) > stored
}
