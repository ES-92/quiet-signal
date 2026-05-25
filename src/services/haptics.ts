// Tiny haptic tap on supported devices (Android/Chrome). iOS Safari ignores
// the Vibration API, so this is a progressive enhancement only.
export function tapHaptic(pattern: number | number[] = 8) {
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    try {
      navigator.vibrate(pattern)
    } catch {
      /* ignore — vibration is best-effort */
    }
  }
}
