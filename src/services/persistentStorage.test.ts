import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { persistRequestStorageKey, requestPersistentStorage, resetPersistentStorageRequest } from './persistentStorage'

function stubStorage(storage: unknown) {
  Object.defineProperty(navigator, 'storage', { value: storage, configurable: true })
}

beforeEach(() => resetPersistentStorageRequest())
afterEach(() => {
  stubStorage(undefined)
  vi.restoreAllMocks()
})

describe('requestPersistentStorage', () => {
  it('fragt nur einmal pro Sitzung nach dauerhaftem Speicher und merkt sich das in sessionStorage', async () => {
    const persist = vi.fn().mockResolvedValue(true)
    stubStorage({ persisted: vi.fn().mockResolvedValue(false), persist })

    await requestPersistentStorage()
    await requestPersistentStorage()

    expect(persist).toHaveBeenCalledTimes(1)
    expect(sessionStorage.getItem(persistRequestStorageKey)).not.toBeNull()
  })

  it('fragt nicht, wenn der Speicher bereits dauerhaft ist', async () => {
    const persist = vi.fn().mockResolvedValue(true)
    stubStorage({ persisted: vi.fn().mockResolvedValue(true), persist })

    await requestPersistentStorage()

    expect(persist).not.toHaveBeenCalled()
  })

  it('fragt nicht erneut, wenn die Sitzung schon gefragt hat (z. B. nach einem Neuladen)', async () => {
    const persist = vi.fn().mockResolvedValue(true)
    stubStorage({ persisted: vi.fn().mockResolvedValue(false), persist })
    sessionStorage.setItem(persistRequestStorageKey, '1')

    await requestPersistentStorage()

    expect(persist).not.toHaveBeenCalled()
  })

  it('übersteht fehlende APIs, abgelehnte Anfragen und gesperrten sessionStorage', async () => {
    stubStorage(undefined)
    await expect(requestPersistentStorage()).resolves.toBeUndefined()

    resetPersistentStorageRequest()
    stubStorage({})
    await expect(requestPersistentStorage()).resolves.toBeUndefined()

    resetPersistentStorageRequest()
    stubStorage({ persisted: vi.fn().mockRejectedValue(new Error('nope')), persist: vi.fn().mockRejectedValue(new Error('nope')) })
    await expect(requestPersistentStorage()).resolves.toBeUndefined()

    resetPersistentStorageRequest()
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError')
    })
    stubStorage({ persist: vi.fn().mockResolvedValue(true) })
    await expect(requestPersistentStorage()).resolves.toBeUndefined()
  })
})
