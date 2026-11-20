import type { Book } from '../types/book'
import type { Quote } from '../types/quote'

const pinStorageKey = 'quiet-signal-pin'
const encryptionStorageKey = 'quiet-signal-encryption'
const iterations = 180000
const verifierVersion = 2
const verifierContext = 'quiet-signal/vault-verifier/v2'
let activeEncryptionKey: CryptoKey | null = null

interface SecretRecord {
  salt: string
  hash: string
}

export interface EncryptionRecord extends SecretRecord {
  enabled: boolean
  /** 2: `hash` is a SHA-256 verifier of the derived bits. Missing: earlier record format. Other values are rejected. */
  version?: number
}

export function notifySecurityChanged() {
  window.dispatchEvent(new Event('quiet-signal-security-changed'))
}

export function lockAppNow() {
  window.dispatchEvent(new Event('quiet-signal-lock-now'))
}

export function hasPinLock() {
  return Boolean(localStorage.getItem(pinStorageKey))
}

export async function setPinLock(pin: string) {
  localStorage.setItem(pinStorageKey, JSON.stringify(await hashSecret(pin)))
  notifySecurityChanged()
}

export async function verifyPin(pin: string) {
  const record = readSecretRecord(pinStorageKey)
  if (!record) return true
  return constantTimeEqual(await hashWithSalt(pin, base64ToBytes(record.salt)), record.hash)
}

export function clearPinLock() {
  localStorage.removeItem(pinStorageKey)
  notifySecurityChanged()
}

export function isEncryptionEnabled() {
  return readEncryptionRecord()?.enabled === true
}

export function isEncryptionUnlocked() {
  return !isEncryptionEnabled() || activeEncryptionKey !== null
}

export async function enableEncryption(password: string) {
  if (isEncryptionEnabled()) throw new Error('Encryption is already enabled.')
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const bits = await derivePasswordBits(password, salt)
  const key = await importAesKey(bits)
  writeEncryptionRecord(salt, await vaultVerifier(bits))
  activeEncryptionKey = key
  notifySecurityChanged()
}

export async function unlockEncryption(password: string) {
  const record = readEncryptionRecord()
  if (!record?.enabled) return true
  const salt = base64ToBytes(record.salt)
  const bits = await derivePasswordBits(password, salt)
  const verifier = await vaultVerifier(bits)

  if (record.version === verifierVersion) {
    if (!constantTimeEqual(verifier, record.hash)) return false
  } else if (record.version === undefined) {
    // Earlier record format: compare against its stored value, then upgrade to version 2 (same salt).
    if (!constantTimeEqual(bytesToBase64(bits), record.hash)) return false
    try {
      writeEncryptionRecord(salt, verifier)
    } catch {
      // Keep the earlier record; the upgrade is retried on the next unlock.
    }
  } else {
    // Unknown record version: refuse to unlock and leave the record untouched.
    return false
  }

  activeEncryptionKey = await importAesKey(bits)
  notifySecurityChanged()
  return true
}

export function lockEncryption() {
  activeEncryptionKey = null
  notifySecurityChanged()
}

export function disableEncryptionRecord() {
  localStorage.removeItem(encryptionStorageKey)
  activeEncryptionKey = null
  notifySecurityChanged()
}

export async function encryptQuoteForStorage(quote: Quote) {
  if (!isEncryptionEnabled()) return stripCryptoFields(quote)
  if (!activeEncryptionKey) throw new Error('Encryption is locked.')

  const plaintextQuote = stripCryptoFields(quote)
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encoded = new TextEncoder().encode(JSON.stringify(plaintextQuote))
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: toArrayBuffer(iv) }, activeEncryptionKey, encoded)

  return {
    id: quote.id,
    text: '',
    tags: [],
    favorite: false,
    likes: 0,
    createdAt: quote.createdAt,
    updatedAt: quote.updatedAt,
    reviewCount: quote.reviewCount,
    encrypted: true,
    encryptedPayload: bytesToBase64(new Uint8Array(encrypted)),
    encryptionIv: bytesToBase64(iv)
  } satisfies Quote
}

export async function decryptQuoteFromStorage(quote: Quote) {
  if (!quote.encrypted) return stripCryptoFields(quote)
  if (!activeEncryptionKey || !quote.encryptedPayload || !quote.encryptionIv) return null

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: toArrayBuffer(base64ToBytes(quote.encryptionIv)) },
    activeEncryptionKey,
    base64ToBytes(quote.encryptedPayload)
  )

  return JSON.parse(new TextDecoder().decode(decrypted)) as Quote
}

export async function encryptBookForStorage(book: Book) {
  if (!isEncryptionEnabled()) return stripBookCryptoFields(book)
  if (!activeEncryptionKey) throw new Error('Encryption is locked.')

  const plaintextBook = stripBookCryptoFields(book)
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encoded = new TextEncoder().encode(JSON.stringify(plaintextBook))
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: toArrayBuffer(iv) }, activeEncryptionKey, encoded)

  return {
    id: book.id,
    title: '',
    weight: book.weight,
    createdAt: book.createdAt,
    updatedAt: book.updatedAt,
    encrypted: true,
    encryptedPayload: bytesToBase64(new Uint8Array(encrypted)),
    encryptionIv: bytesToBase64(iv)
  } satisfies Book
}

export async function decryptBookFromStorage(book: Book) {
  if (!book.encrypted) return stripBookCryptoFields(book)
  if (!activeEncryptionKey || !book.encryptedPayload || !book.encryptionIv) return null

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: toArrayBuffer(base64ToBytes(book.encryptionIv)) },
    activeEncryptionKey,
    base64ToBytes(book.encryptedPayload)
  )

  return JSON.parse(new TextDecoder().decode(decrypted)) as Book
}

function stripCryptoFields(quote: Quote): Quote {
  const { encrypted, encryptedPayload, encryptionIv, ...plain } = quote
  return plain
}

function stripBookCryptoFields(book: Book): Book {
  const { encrypted, encryptedPayload, encryptionIv, ...plain } = book
  return plain
}

function readSecretRecord(key: string) {
  try {
    const value = localStorage.getItem(key)
    return value ? (JSON.parse(value) as SecretRecord) : null
  } catch {
    return null
  }
}

function readEncryptionRecord() {
  try {
    const value = localStorage.getItem(encryptionStorageKey)
    return value ? (JSON.parse(value) as EncryptionRecord) : null
  } catch {
    return null
  }
}

async function hashSecret(secret: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  return { salt: bytesToBase64(salt), hash: await hashWithSalt(secret, salt) }
}

async function hashWithSalt(secret: string, salt: Uint8Array) {
  return bytesToBase64(await derivePasswordBits(secret, salt))
}

function writeEncryptionRecord(salt: Uint8Array, verifier: string) {
  const record: EncryptionRecord = {
    enabled: true,
    salt: bytesToBase64(salt),
    hash: verifier,
    version: verifierVersion
  }
  localStorage.setItem(encryptionStorageKey, JSON.stringify(record))
}

/** PBKDF2-SHA-256 (256 bits); the vault key and the verifier are both derived from these bits. */
async function derivePasswordBits(secret: string, salt: Uint8Array) {
  const key = await deriveBitsKey(secret)
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: toArrayBuffer(salt), iterations, hash: 'SHA-256' },
    key,
    256
  )
  return new Uint8Array(bits)
}

/** Imports the derived bits as a non-extractable AES-GCM-256 key. */
function importAesKey(bits: Uint8Array) {
  return crypto.subtle.importKey('raw', toArrayBuffer(bits), 'AES-GCM', false, ['encrypt', 'decrypt'])
}

/** Verifier is a one-way hash of the derived bits with a fixed context prefix: SHA-256(context || bits). */
async function vaultVerifier(bits: Uint8Array) {
  const context = new TextEncoder().encode(verifierContext)
  const input = new Uint8Array(context.length + bits.length)
  input.set(context)
  input.set(bits, context.length)
  return bytesToBase64(new Uint8Array(await crypto.subtle.digest('SHA-256', input)))
}

function deriveBitsKey(secret: string) {
  return crypto.subtle.importKey('raw', new TextEncoder().encode(secret), 'PBKDF2', false, ['deriveBits'])
}

function bytesToBase64(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes))
}

function base64ToBytes(value: string) {
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0))
}

function toArrayBuffer(bytes: Uint8Array) {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
}

function constantTimeEqual(left: string, right: string) {
  if (left.length !== right.length) return false
  let result = 0
  for (let index = 0; index < left.length; index += 1) {
    result |= left.charCodeAt(index) ^ right.charCodeAt(index)
  }
  return result === 0
}
