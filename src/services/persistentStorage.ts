// Safari (and others under storage pressure) may evict IndexedDB for sites without persistent storage, which
// would wipe the local library. Ask once per browser session, as soon as the library holds something, and not at
// all if storage is already persistent (Firefox would otherwise prompt on every launch). Never throws.
export const persistRequestStorageKey = 'quiet-signal-persist-requested'

// Fallback when sessionStorage is unavailable, and a guard against parallel calls within one page.
let requestedInPage = false

export async function requestPersistentStorage(): Promise<void> {
  if (requestedInPage || readSessionFlag()) return
  requestedInPage = true
  writeSessionFlag()
  try {
    const storage = navigator.storage
    if (!storage?.persist) return
    if (await storage.persisted?.()) return
    await storage.persist()
  } catch {
    // Not supported or refused: nothing else to do.
  }
}

/** Test helper: allows another request in the same session. */
export function resetPersistentStorageRequest() {
  requestedInPage = false
  try {
    sessionStorage.removeItem(persistRequestStorageKey)
  } catch {
    // Ignore.
  }
}

function readSessionFlag() {
  try {
    return sessionStorage.getItem(persistRequestStorageKey) !== null
  } catch {
    return false
  }
}

function writeSessionFlag() {
  try {
    sessionStorage.setItem(persistRequestStorageKey, '1')
  } catch {
    // The in-page flag still limits it to once per page.
  }
}
