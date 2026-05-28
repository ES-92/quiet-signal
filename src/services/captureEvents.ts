import { tapHaptic } from './haptics'

export type CaptureMode = 'text' | 'photo' | 'audio'

export const captureEventName = 'quiet-signal-open-capture'

export function isCaptureMode(value: unknown): value is CaptureMode {
  return value === 'text' || value === 'photo' || value === 'audio'
}

export function openCapture(mode: CaptureMode = 'text') {
  tapHaptic(8)
  window.dispatchEvent(new CustomEvent(captureEventName, { detail: { mode } }))
}
