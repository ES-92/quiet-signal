import type { Quote } from '../types/quote'
import { effectiveDueAt } from './lifecycle'

const maxDaysShown = 60
const daysPerMonth = 30

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
}

// Signed calendar days from today to the effective due date: negative when overdue, 0 when due today, undated or unparsable.
// Uses effectiveDueAt, so a legacy favourite is never further away than 30 days. Card and info line both build on this.
function daysUntilDue(quote: Quote, now: Date): number {
  const due = effectiveDueAt(quote)
  const dueTime = due ? new Date(due).getTime() : Number.NaN
  if (Number.isNaN(dueTime)) return 0
  return Math.round((startOfDay(new Date(dueTime)) - startOfDay(now)) / 86_400_000)
}

// Calendar days until a signal comes back. Due today, overdue and undated (or unparsable) all count as 0.
export function dueInDays(quote: Quote, now = new Date()): number {
  return Math.max(0, daysUntilDue(quote, now))
}

// Calendar days a signal is past its due date; 0 when due today, in the future or undated.
export function overdueDays(quote: Quote, now = new Date()): number {
  return Math.max(0, -daysUntilDue(quote, now))
}

// "heute" / "morgen" / "in 12 Tagen"; beyond 60 days in months ("in 3 Monaten"). At least 2 months, so 61 days never reads shorter than 60.
export function formatDueIn(days: number, locale: string): string {
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
  if (days <= maxDaysShown) return formatter.format(days, 'day')
  return formatter.format(Math.max(2, Math.floor(days / daysPerMonth)), 'month')
}
