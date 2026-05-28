import type { TranslationKey } from '../i18n/translations'

export const APP_VERSION = '0.2.0'

const versionKey = 'quiet-signal-last-seen-version'

export interface ReleaseNote {
  version: string
  items: TranslationKey[]
}

export const releaseNotes: ReleaseNote[] = [
  { version: '0.2.0', items: ['release020Gestures', 'release020Onboarding', 'release020Brand'] }
]

export function lastSeenVersion() {
  return localStorage.getItem(versionKey)
}

export function markVersionSeen() {
  localStorage.setItem(versionKey, APP_VERSION)
}

export function ensureVersionInitialized() {
  if (!lastSeenVersion()) localStorage.setItem(versionKey, APP_VERSION)
}

export function shouldShowWhatsNew() {
  const seen = lastSeenVersion()
  return Boolean(seen) && compareVersions(APP_VERSION, seen as string) > 0
}

export function notesSince(seen: string | null): ReleaseNote[] {
  if (!seen) return []
  return releaseNotes.filter((note) => compareVersions(note.version, seen) > 0)
}

function compareVersions(a: string, b: string) {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let index = 0; index < Math.max(pa.length, pb.length); index += 1) {
    const diff = (pa[index] ?? 0) - (pb[index] ?? 0)
    if (diff !== 0) return diff
  }
  return 0
}
