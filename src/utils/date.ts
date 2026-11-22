/** Returns the local calendar date as YYYY-MM-DD (not the UTC date). */
export function localDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const MS_PER_DAY = 86_400_000

function startOfLocalDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
}

/** Relative day label ("heute", "gestern", "vor 3 Monaten") for an ISO timestamp, in the given UI language. */
export function formatRelativeDay(iso: string, now: Date, language: string): string {
  const formatter = new Intl.RelativeTimeFormat(language, { numeric: 'auto' })
  // An unparsable stored date reads as today instead of making Intl throw a RangeError during render.
  const raw = Math.round((startOfLocalDay(now) - startOfLocalDay(new Date(iso))) / MS_PER_DAY)
  const days = Number.isFinite(raw) ? Math.max(0, raw) : 0
  if (days < 30) return formatter.format(-days, 'day')
  if (days < 365) return formatter.format(-Math.floor(days / 30), 'month')
  return formatter.format(-Math.floor(days / 365), 'year')
}
