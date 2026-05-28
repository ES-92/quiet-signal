import type { CaptureMode } from './captureEvents'

export function shortcutUrl(mode: CaptureMode) {
  return new URL(`/today?capture=${mode}`, window.location.origin).toString()
}

export async function copyShortcutUrl(mode: CaptureMode) {
  const url = shortcutUrl(mode)
  await navigator.clipboard.writeText(url)
  return url
}
