// Safari (and others under storage pressure) may evict IndexedDB for sites without persistent storage, which
// would wipe the local library. Ask once per page session, as soon as the library holds something. Never throws.
let requested = false

export async function requestPersistentStorage(): Promise<void> {
  if (requested) return
  requested = true
  try {
    await navigator.storage?.persist?.()
  } catch {
    // Not supported or refused: nothing else to do.
  }
}

/** Test helper: allows another request in the same page session. */
export function resetPersistentStorageRequest() {
  requested = false
}
