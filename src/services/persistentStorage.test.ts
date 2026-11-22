import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { requestPersistentStorage, resetPersistentStorageRequest } from './persistentStorage'

function stubStorage(storage: unknown) {
  Object.defineProperty(navigator, 'storage', { value: storage, configurable: true })
}

beforeEach(() => resetPersistentStorageRequest())
afterEach(() => stubStorage(undefined))

describe('requestPersistentStorage', () => {
  it('fragt nur einmal pro Sitzung nach dauerhaftem Speicher', async () => {
    const persist = vi.fn().mockResolvedValue(true)
    stubStorage({ persist })

    await requestPersistentStorage()
    await requestPersistentStorage()

    expect(persist).toHaveBeenCalledTimes(1)
  })

  it('übersteht fehlende APIs und abgelehnte Anfragen', async () => {
    stubStorage(undefined)
    await expect(requestPersistentStorage()).resolves.toBeUndefined()

    resetPersistentStorageRequest()
    stubStorage({})
    await expect(requestPersistentStorage()).resolves.toBeUndefined()

    resetPersistentStorageRequest()
    stubStorage({ persist: vi.fn().mockRejectedValue(new Error('nope')) })
    await expect(requestPersistentStorage()).resolves.toBeUndefined()
  })
})
