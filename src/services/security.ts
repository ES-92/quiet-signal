import type { Book } from '../types/book'
import type { Quote } from '../types/quote'

const pinStorageKey = 'quiet-signal-pin'
const encryptionStorageKey = 'quiet-signal-encryption'
const iterations = 180000
let activeEncryptionKey: CryptoKey | null = null

interface SecretRecord {
  salt: string
  hash: string
}

export interface EncryptionRecord extends SecretRecord {
  enabled: boolean
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
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const key = await deriveAesKey(password, salt)
  const hash = await hashWithSalt(password, salt)
  activeEncryptionKey = key
  localStorage.setItem(encryptionStorageKey, JSON.stringify({ enabled: true, salt: bytesToBase64(salt), hash }))
  notifySecurityChanged()
}

export async function unlockEncryption(password: string) {
  const record = readEncryptionRecord()
  if (!record?.enabled) return true
  const salt = base64ToBytes(record.salt)
  const hash = await hashWithSalt(password, salt)
  if (!constantTimeEqual(hash, record.hash)) return false
  activeEncryptionKey = await deriveAesKey(password, salt)
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
  const key = await deriveBitsKey(secret)
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: toArrayBuffer(salt), iterations, hash: 'SHA-256' }, key, 256)
  return bytesToBase64(new Uint8Array(bits))
}

async function deriveAesKey(password: string, salt: Uint8Array) {
  const key = await deriveBitsKey(password)
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: toArrayBuffer(salt), iterations, hash: 'SHA-256' },
    key,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

function deriveBitsKey(secret: string) {
  return crypto.subtle.importKey('raw', new TextEncoder().encode(secret), 'PBKDF2', false, ['deriveBits', 'deriveKey'])
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
