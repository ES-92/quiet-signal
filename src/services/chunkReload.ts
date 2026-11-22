// After an update the old page may ask for a lazy chunk that no longer exists on the server. A reload picks up
// the new build. To avoid a reload loop (the chunk is really missing, offline), only one automatic reload is
// allowed per short window, remembered in sessionStorage.
export const chunkReloadStorageKey = 'quiet-signal-chunk-reload'
const chunkReloadWindowMs = 60_000
const chunkLoadErrorPattern =
  /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i

export function isChunkLoadError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : ''
  return chunkLoadErrorPattern.test(message)
}

/** Reloads once for a chunk-load error. Returns true if a reload was started. */
export function reloadOnceForChunkError(error: unknown, now = Date.now()): boolean {
  if (!isChunkLoadError(error)) return false
  try {
    const last = Number(sessionStorage.getItem(chunkReloadStorageKey))
    // A stamp in the future (clock moved back) counts as expired, so it cannot block reloads for long.
    if (Number.isFinite(last) && last > 0 && last <= now && now - last < chunkReloadWindowMs) return false
    sessionStorage.setItem(chunkReloadStorageKey, String(now))
  } catch {
    // Without sessionStorage there is no loop guard, so do not reload automatically.
    return false
  }
  window.location.reload()
  return true
}
