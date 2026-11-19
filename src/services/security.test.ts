import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { makeBook, makeQuote, resetFactories } from '../test/factories'
import {
  clearPinLock,
  decryptBookFromStorage,
  decryptQuoteFromStorage,
  disableEncryptionRecord,
  enableEncryption,
  encryptBookForStorage,
  encryptQuoteForStorage,
  hasPinLock,
  isEncryptionEnabled,
  isEncryptionUnlocked,
  lockEncryption,
  setPinLock,
  unlockEncryption,
  verifyPin
} from './security'

// PBKDF2 mit 180 000 Iterationen ist langsam; Timeout nur für diese Datei erhöhen.
vi.setConfig({ testTimeout: 30000 })

beforeEach(() => {
  resetFactories()
})

afterEach(() => {
  lockEncryption()
  disableEncryptionRecord()
  clearPinLock()
})

describe('WebCrypto-Verfügbarkeit', () => {
  it('stellt crypto.subtle in der Testumgebung bereit', () => {
    // Arrange / Act
    const subtle = globalThis.crypto?.subtle

    // Assert
    expect(subtle).toBeDefined()
    expect(typeof subtle.encrypt).toBe('function')
  })
})

describe('PIN-Sperre', () => {
  it('akzeptiert die richtige PIN und lehnt eine falsche ab', async () => {
    // Arrange
    await setPinLock('1234')

    // Act
    const richtig = await verifyPin('1234')
    const falsch = await verifyPin('0000')

    // Assert
    expect(hasPinLock()).toBe(true)
    expect(richtig).toBe(true)
    expect(falsch).toBe(false)
  })

  it('entfernt die PIN-Sperre mit clearPinLock', async () => {
    // Arrange
    await setPinLock('1234')

    // Act
    clearPinLock()

    // Assert
    expect(hasPinLock()).toBe(false)
  })

  it('speichert die PIN nicht im Klartext', async () => {
    // Arrange / Act
    await setPinLock('1234')
    const dump = JSON.stringify({ ...localStorage })

    // Assert
    expect(dump).not.toContain('1234')
    const stored = JSON.parse(localStorage.getItem('quiet-signal-pin') ?? '{}')
    expect(Object.keys(stored).sort()).toEqual(['hash', 'salt'])
  })

  it('verwendet pro Setzen ein neues Salz', async () => {
    // Arrange
    await setPinLock('1234')
    const first = JSON.parse(localStorage.getItem('quiet-signal-pin') ?? '{}')

    // Act
    await setPinLock('1234')
    const second = JSON.parse(localStorage.getItem('quiet-signal-pin') ?? '{}')

    // Assert
    expect(second.salt).not.toBe(first.salt)
    expect(second.hash).not.toBe(first.hash)
  })

  it('meldet Änderungen per Window-Event', async () => {
    // Arrange
    const listener = vi.fn()
    window.addEventListener('quiet-signal-security-changed', listener)

    // Act
    await setPinLock('1234')
    clearPinLock()

    // Assert
    expect(listener).toHaveBeenCalledTimes(2)
    window.removeEventListener('quiet-signal-security-changed', listener)
  })

  it('lässt jede PIN durch, wenn keine PIN gesetzt ist', async () => {
    // Arrange: keine PIN

    // Act
    const result = await verifyPin('irgendwas')

    // Assert
    expect(hasPinLock()).toBe(false)
    expect(result).toBe(true)
  })
})

describe('Verschlüsselung', () => {
  it('lässt Quotes ohne aktivierte Verschlüsselung unverändert (ohne Crypto-Felder)', async () => {
    // Arrange
    const quote = makeQuote({ text: 'Offen', encrypted: true, encryptedPayload: 'x', encryptionIv: 'y' })

    // Act
    const stored = await encryptQuoteForStorage(quote)

    // Assert
    expect(isEncryptionEnabled()).toBe(false)
    expect(isEncryptionUnlocked()).toBe(true)
    expect(stored.text).toBe('Offen')
    expect(stored).not.toHaveProperty('encrypted')
    expect(stored).not.toHaveProperty('encryptedPayload')
    expect(stored).not.toHaveProperty('encryptionIv')
  })

  it('lässt Books ohne aktivierte Verschlüsselung unverändert (ohne Crypto-Felder)', async () => {
    // Arrange
    const book = makeBook({ title: 'Offen', encrypted: true, encryptedPayload: 'x', encryptionIv: 'y' })

    // Act
    const stored = await encryptBookForStorage(book)

    // Assert
    expect(stored.title).toBe('Offen')
    expect(stored).not.toHaveProperty('encrypted')
    expect(stored).not.toHaveProperty('encryptedPayload')
    expect(stored).not.toHaveProperty('encryptionIv')
  })

  it('verschlüsselt und entschlüsselt ein Quote im Roundtrip', async () => {
    // Arrange
    const quote = makeQuote({ text: 'Geheimer Gedanke', tags: ['privat'], favorite: true, likes: 2 })
    await enableEncryption('pw')

    // Act
    const stored = await encryptQuoteForStorage(quote)
    const restored = await decryptQuoteFromStorage(stored)

    // Assert
    expect(isEncryptionEnabled()).toBe(true)
    expect(stored.text).toBe('')
    expect(stored.encrypted).toBe(true)
    expect(stored.encryptedPayload).toBeTruthy()
    expect(JSON.stringify(stored)).not.toContain('Geheimer Gedanke')
    expect(restored).toEqual(quote)
    expect(restored).not.toHaveProperty('encrypted')
  })

  it('verschlüsselt und entschlüsselt ein Book im Roundtrip', async () => {
    // Arrange
    const book = makeBook({ title: 'Geheimes Buch', author: 'Jane Doe' })
    await enableEncryption('pw')

    // Act
    const stored = await encryptBookForStorage(book)
    const restored = await decryptBookFromStorage(stored)

    // Assert
    expect(stored.title).toBe('')
    expect(stored.encrypted).toBe(true)
    expect(JSON.stringify(stored)).not.toContain('Geheimes Buch')
    expect(restored).toEqual(book)
    expect(restored).not.toHaveProperty('encrypted')
  })

  it('verwendet für zwei Verschlüsselungen desselben Quotes unterschiedliche IVs', async () => {
    // Arrange
    const quote = makeQuote({ text: 'Gleicher Text' })
    await enableEncryption('pw')

    // Act
    const first = await encryptQuoteForStorage(quote)
    const second = await encryptQuoteForStorage(quote)

    // Assert
    expect(first.encryptionIv).not.toBe(second.encryptionIv)
    expect(first.encryptedPayload).not.toBe(second.encryptedPayload)
  })

  it('wirft beim Verschlüsseln im gesperrten Zustand und liefert beim Entschlüsseln null', async () => {
    // Arrange
    const quote = makeQuote()
    const book = makeBook()
    await enableEncryption('pw')
    const storedQuote = await encryptQuoteForStorage(quote)
    const storedBook = await encryptBookForStorage(book)

    // Act
    lockEncryption()

    // Assert
    expect(isEncryptionEnabled()).toBe(true)
    expect(isEncryptionUnlocked()).toBe(false)
    await expect(encryptQuoteForStorage(quote)).rejects.toThrow('Encryption is locked.')
    await expect(encryptBookForStorage(book)).rejects.toThrow('Encryption is locked.')
    expect(await decryptQuoteFromStorage(storedQuote)).toBeNull()
    expect(await decryptBookFromStorage(storedBook)).toBeNull()
  })

  it('lehnt ein falsches Passwort ab und entsperrt mit dem richtigen', async () => {
    // Arrange
    const quote = makeQuote({ text: 'Wieder lesbar' })
    await enableEncryption('pw')
    const stored = await encryptQuoteForStorage(quote)
    lockEncryption()

    // Act
    const falsch = await unlockEncryption('falsch')
    const stillLocked = isEncryptionUnlocked()
    const richtig = await unlockEncryption('pw')
    const restored = await decryptQuoteFromStorage(stored)

    // Assert
    expect(falsch).toBe(false)
    expect(stillLocked).toBe(false)
    expect(richtig).toBe(true)
    expect(isEncryptionUnlocked()).toBe(true)
    expect(restored).toEqual(quote)
  })

  it('liefert true beim Entsperren, wenn keine Verschlüsselung aktiv ist', async () => {
    // Arrange: keine Verschlüsselung

    // Act
    const result = await unlockEncryption('egal')

    // Assert
    expect(result).toBe(true)
  })

  it('gibt unverschlüsselte Quotes beim Entschlüsseln unverändert zurück, auch gesperrt', async () => {
    // Arrange
    const quote = makeQuote({ text: 'Klartext' })

    // Act
    const restored = await decryptQuoteFromStorage(quote)

    // Assert
    expect(restored).toEqual(quote)
  })

  it('liefert null bei verschlüsselten Einträgen ohne Payload oder IV', async () => {
    // Arrange
    await enableEncryption('pw')
    const incomplete = makeQuote({ encrypted: true })

    // Act
    const result = await decryptQuoteFromStorage(incomplete)

    // Assert
    expect(result).toBeNull()
  })

  it('speichert das Passwort nicht im Klartext', async () => {
    // Arrange / Act
    await enableEncryption('geheimes-passwort')

    // Assert
    expect(JSON.stringify({ ...localStorage })).not.toContain('geheimes-passwort')
  })

  it('entfernt mit disableEncryptionRecord Eintrag und Schlüssel', async () => {
    // Arrange
    await enableEncryption('pw')

    // Act
    disableEncryptionRecord()

    // Assert
    expect(isEncryptionEnabled()).toBe(false)
    expect(isEncryptionUnlocked()).toBe(true)
  })
})
