import type { ActivityEvent, ActivityType } from '../types/quote'

export const maxActivityEvents = 200
const activityTypes = new Set<ActivityType>(['more', 'less', 'rest', 'wake', 'thought'])

// Appends one event and keeps only the newest maxActivityEvents; never mutates the given log.
export function appendActivity(activity: ActivityEvent[] | undefined, type: ActivityType, now = new Date()): ActivityEvent[] {
  return [...(activity ?? []), { at: now.toISOString(), type }].slice(-maxActivityEvents)
}

// Drops the newest event that matches (used by undo, so the strip does not count an undone action).
export function removeLatestActivity(
  activity: ActivityEvent[] | undefined,
  matches: (event: ActivityEvent) => boolean
): ActivityEvent[] | undefined {
  if (!activity) return activity
  for (let index = activity.length - 1; index >= 0; index -= 1) {
    if (matches(activity[index])) return [...activity.slice(0, index), ...activity.slice(index + 1)]
  }
  return activity
}

// Import validation: keeps {at: parseable date, type in the enum}, normalises dates to ISO and caps the log.
export function normalizeActivity(value: unknown): ActivityEvent[] | undefined {
  if (!Array.isArray(value)) return undefined
  const events: ActivityEvent[] = []
  for (const item of value) {
    if (!item || typeof item !== 'object') continue
    const { at, type } = item as Record<string, unknown>
    if (typeof at !== 'string' || typeof type !== 'string') continue
    if (!activityTypes.has(type as ActivityType) || Number.isNaN(Date.parse(at))) continue
    events.push({ at: new Date(at).toISOString(), type: type as ActivityType })
  }
  return events.slice(-maxActivityEvents)
}
