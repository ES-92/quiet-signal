// Shared between the app and the service worker. Keep it free of any
// window/DOM-only APIs — `caches`, `Response` and `Date` exist in both.

export const REMINDER_CACHE = 'commonplace-reminder'
export const REMINDER_KEY = '/__commonplace_reminder__'
export const REMINDER_TAG = 'commonplace-daily-reminder'

export interface ReminderConfig {
  enabled: boolean
  /** Local time of day in 24h "HH:MM". */
  time: string
  title: string
  body: string
  /** Local "YYYY-MM-DD" of the last time a reminder fired. */
  lastShown?: string
}

export async function readReminderConfig(): Promise<ReminderConfig | null> {
  try {
    const cache = await caches.open(REMINDER_CACHE)
    const response = await cache.match(REMINDER_KEY)
    return response ? ((await response.json()) as ReminderConfig) : null
  } catch {
    return null
  }
}

export async function writeReminderConfig(config: ReminderConfig): Promise<void> {
  const cache = await caches.open(REMINDER_CACHE)
  await cache.put(
    REMINDER_KEY,
    new Response(JSON.stringify(config), { headers: { 'content-type': 'application/json' } })
  )
}

/** Local calendar day (not UTC) so "today" matches the user's wall clock. */
export function localDateKey(date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** True once the wall clock has passed the given "HH:MM" today. */
export function isAfterTime(time: string, now = new Date()): boolean {
  const [hours, minutes] = time.split(':').map(Number)
  if (Number.isNaN(hours)) return true
  const target = new Date(now)
  target.setHours(hours, minutes || 0, 0, 0)
  return now.getTime() >= target.getTime()
}
